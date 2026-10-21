package br.com.rotinaazul;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Toca o alarme em loop (som e vibração) até o usuário agir: "Já tomei", "Adiar" ou "Parar".
 * Sem resposta, para sozinho depois de LIMITE_MS e deixa um aviso comum na barra.
 */
public class AlarmeService extends Service {

    static final String ACAO_TOCAR = "br.com.rotinaazul.TOCAR";
    static final String ACAO_TOMEI = "br.com.rotinaazul.TOMEI";
    static final String ACAO_ADIAR = "br.com.rotinaazul.ADIAR";
    static final String ACAO_PARAR = "br.com.rotinaazul.PARAR";
    /** Broadcasts para a tela de alarme. */
    static final String ACAO_FECHAR = "br.com.rotinaazul.FECHAR_TELA";
    static final String ACAO_ATUALIZAR = "br.com.rotinaazul.ATUALIZAR_TELA";
    static final String EXTRA_ALARMES = "alarmes";

    static final int ADIAR_MIN = 10;
    private static final long LIMITE_MS = 10 * 60_000L;
    private static final int NOTIFICACAO = 4242;
    private static final int NOTIFICACAO_PERDIDO = 4243;

    /** O que está tocando agora (JSON), para a tela ler ao abrir. Nulo quando parado. */
    static volatile String atual;

    private final List<JSONObject> tocando = new ArrayList<>();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private MediaPlayer player;
    private PowerManager.WakeLock wakeLock;
    private final Runnable aoExpirar = this::expirar;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String acao = intent == null ? null : intent.getAction();
        if (ACAO_TOCAR.equals(acao)) {
            // O Android exige startForeground logo depois de startForegroundService.
            adicionar(AlarmeReceiver.doJson(intent.getStringExtra(EXTRA_ALARMES)));
            iniciarOuAtualizar();
        } else if (tocando.isEmpty()) {
            stopSelf();
        } else if (ACAO_TOMEI.equals(acao)) {
            AlarmeStore.marcarTomada(this, tocando);
            encerrar();
        } else if (ACAO_ADIAR.equals(acao)) {
            for (JSONObject a : tocando) adiar(this, a, ADIAR_MIN);
            encerrar();
        } else if (ACAO_PARAR.equals(acao)) {
            encerrar();
        }
        return START_NOT_STICKY;
    }

    /** Novo alarme com o mesmo horário do 2º aviso etc.: junta ao que já toca, sem repetir. */
    private void adicionar(List<JSONObject> novos) {
        for (JSONObject n : novos) {
            boolean repetido = false;
            for (JSONObject t : tocando) repetido |= t.optInt("id") == n.optInt("id");
            if (!repetido) tocando.add(n);
        }
    }

    static void adiar(Context c, JSONObject a, int minutos) {
        try {
            JSONObject copia = new JSONObject(a.toString());
            copia.put("kind", "adiado");
            copia.put("id", (int) (System.nanoTime() & 0x7fffffff));
            copia.put("at", System.currentTimeMillis() + minutos * 60_000L);
            AlarmeStore.adicionar(c, copia);
        } catch (JSONException ignorado) {
            // cópia de um JSON válido: não falha
        }
    }

    private void iniciarOuAtualizar() {
        boolean primeira = player == null && wakeLock == null;
        atual = new JSONArray(tocando).toString();
        ServiceCompat.startForeground(
            this,
            NOTIFICACAO,
            criarNotificacao(),
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                : 0
        );
        if (primeira) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "rotinaazul:alarme");
            wakeLock.acquire(LIMITE_MS + 60_000L);
            tocarSom();
            vibrar();
            handler.postDelayed(aoExpirar, LIMITE_MS);
        } else {
            sendBroadcast(new Intent(ACAO_ATUALIZAR).setPackage(getPackageName()));
        }
    }

    private void tocarSom() {
        Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        try {
            player = new MediaPlayer();
            player.setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            );
            player.setDataSource(this, uri);
            player.setLooping(true);
            player.prepare();
            player.start();
        } catch (Exception e) {
            // Sem som, a vibração e a tela ainda avisam.
            if (player != null) player.release();
            player = null;
        }
    }

    private void vibrar() {
        Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (v == null || !v.hasVibrator()) return;
        long[] padrao = { 0, 800, 600 };
        AudioAttributes alarme = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            v.vibrate(VibrationEffect.createWaveform(padrao, 0), alarme);
        } else {
            v.vibrate(padrao, 0, alarme);
        }
    }

    private PendingIntent acao(String acao, int codigo) {
        return PendingIntent.getService(
            this,
            codigo,
            new Intent(this, AlarmeService.class).setAction(acao),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private Notification criarNotificacao() {
        Canais.garantir(this);
        PendingIntent tela = PendingIntent.getActivity(
            this,
            1,
            new Intent(this, AlarmeActivity.class).addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP
            ),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, Canais.ALARME)
            .setSmallIcon(R.drawable.ic_stat_lembrete)
            .setColor(0xFF2C4A6B)
            .setContentTitle(titulo(tocando))
            .setContentText(corpo(tocando))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(corpo(tocando)))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(tela)
            .setFullScreenIntent(tela, true)
            .setDeleteIntent(acao(ACAO_PARAR, 4));
        if (temDose(tocando)) {
            b.addAction(0, "Já tomei", acao(ACAO_TOMEI, 2));
            b.addAction(0, "Adiar " + ADIAR_MIN + " min", acao(ACAO_ADIAR, 3));
        } else {
            b.addAction(0, "Parar", acao(ACAO_PARAR, 4));
        }
        return b.build();
    }

    /** Ninguém atendeu: para o som, mas deixa um aviso comum para ver depois. */
    private void expirar() {
        Notification n = new NotificationCompat.Builder(this, Canais.LEMBRETES)
            .setSmallIcon(R.drawable.ic_stat_lembrete)
            .setColor(0xFF2C4A6B)
            .setContentTitle("⏰ Alarme não atendido")
            .setContentText(corpo(tocando))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(corpo(tocando)))
            .setAutoCancel(true)
            .setContentIntent(
                PendingIntent.getActivity(
                    this,
                    5,
                    new Intent(this, MainActivity.class),
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                )
            )
            .build();
        try {
            getSystemService(NotificationManager.class).notify(NOTIFICACAO_PERDIDO, n);
        } catch (SecurityException semPermissao) {
            // sem permissão de notificações
        }
        encerrar();
    }

    private void encerrar() {
        handler.removeCallbacks(aoExpirar);
        if (player != null) {
            try {
                player.stop();
            } catch (IllegalStateException ignorado) {
                // já parado
            }
            player.release();
            player = null;
        }
        Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (v != null) v.cancel();
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
        tocando.clear();
        atual = null;
        sendBroadcast(new Intent(ACAO_FECHAR).setPackage(getPackageName()));
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(aoExpirar);
        if (player != null) player.release();
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        atual = null;
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // ── Textos (também usados pela tela de alarme) ──────────────────────────

    static boolean temDose(List<JSONObject> lista) {
        for (JSONObject a : lista) if (!a.optString("medId").isEmpty()) return true;
        return false;
    }

    static String titulo(List<JSONObject> lista) {
        if (lista.size() == 1) return lista.get(0).optString("title");
        return "💊 " + lista.size() + " remédios para tomar";
    }

    static String corpo(List<JSONObject> lista) {
        if (lista.size() == 1) return lista.get(0).optString("body");
        StringBuilder sb = new StringBuilder();
        for (JSONObject a : lista) {
            if (sb.length() > 0) sb.append('\n');
            String pessoa = a.optString("pessoa");
            sb.append(a.optString("body"));
            if (!pessoa.isEmpty()) sb.append(" (").append(pessoa).append(')');
        }
        return sb.toString();
    }
}
