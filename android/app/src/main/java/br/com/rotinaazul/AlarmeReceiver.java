package br.com.rotinaazul;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/** Recebe o disparo do alarme agendado e também refaz a fila depois de reiniciar o celular. */
public class AlarmeReceiver extends BroadcastReceiver {

    static final String ACAO_DISPARAR = "br.com.rotinaazul.DISPARAR";

    @Override
    public void onReceive(Context c, Intent intent) {
        String acao = intent.getAction();
        if (!ACAO_DISPARAR.equals(acao)) {
            // Reinício, troca de hora/fuso ou atualização do app: o sistema perdeu o alarme agendado.
            AlarmeStore.agendarProximo(c);
            return;
        }

        List<JSONObject> vencidos = AlarmeStore.retirarVencidos(c);
        AlarmeStore.agendarProximo(c);

        JSONArray tocar = new JSONArray();
        for (JSONObject a : vencidos) {
            if ("vespera".equals(a.optString("kind"))) avisar(c, a);
            else tocar.put(a);
        }
        if (tocar.length() > 0) {
            Intent servico = new Intent(c, AlarmeService.class)
                .setAction(AlarmeService.ACAO_TOCAR)
                .putExtra(AlarmeService.EXTRA_ALARMES, tocar.toString());
            ContextCompat.startForegroundService(c, servico);
        }
    }

    /** Aviso comum (sem tela de alarme): véspera de consulta ou exame. */
    private static void avisar(Context c, JSONObject a) {
        Canais.garantir(c);
        PendingIntent abrir = PendingIntent.getActivity(
            c,
            a.optInt("id"),
            new Intent(c, MainActivity.class),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification n = new NotificationCompat.Builder(c, Canais.LEMBRETES)
            .setSmallIcon(R.drawable.ic_stat_lembrete)
            .setColor(0xFF2C4A6B)
            .setContentTitle(a.optString("title"))
            .setContentText(a.optString("body"))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(a.optString("body")))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(abrir)
            .build();
        try {
            c.getSystemService(NotificationManager.class).notify(a.optInt("id"), n);
        } catch (SecurityException semPermissao) {
            // sem permissão de notificações: nada a fazer
        }
    }

    static List<JSONObject> doJson(String json) {
        List<JSONObject> out = new ArrayList<>();
        try {
            JSONArray arr = new JSONArray(json == null ? "[]" : json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o != null) out.add(o);
            }
        } catch (Exception ignorado) {
            // JSON inválido: sem alarmes
        }
        return out;
    }
}
