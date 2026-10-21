package br.com.rotinaazul;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * O que o plugin de notificações locais não cobre: o canal com som de alarme
 * e a liberação da economia de bateria.
 */
@CapacitorPlugin(name = "Confiabilidade")
public class ConfiabilidadePlugin extends Plugin {

    /** Mesmo id usado em src/lib/alarmes.ts. */
    static final String CANAL = "lembretes";

    @Override
    public void load() {
        criarCanal();
    }

    /**
     * Toca pelo volume de alarme: soa com o celular no silencioso/vibrar e, na
     * maioria dos aparelhos, também no Não Perturbe (alarmes são liberados por padrão).
     * Um canal não pode ser alterado depois de criado; para mudar, troque o id.
     */
    private void criarCanal() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getContext().getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CANAL) != null) return;
        NotificationChannel canal = new NotificationChannel(
            CANAL,
            "Lembretes de remédios e consultas",
            NotificationManager.IMPORTANCE_HIGH
        );
        canal.setDescription("Avisos na hora de cada dose e na véspera das consultas.");
        Uri som = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (som == null) som = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        canal.setSound(
            som,
            new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        );
        canal.enableVibration(true);
        canal.setVibrationPattern(new long[] { 0, 600, 300, 600, 300, 600 });
        canal.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(canal);
    }

    @PluginMethod
    public void status(PluginCall call) {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        JSObject ret = new JSObject();
        ret.put("bateriaLiberada", pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        call.resolve(ret);
    }

    /**
     * Abre a lista de "otimização de bateria" para a pessoa marcar o app como
     * "Não otimizar". Não usa REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, que a Play Store restringe.
     */
    @PluginMethod
    public void abrirBateria(PluginCall call) {
        try {
            abrir(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        } catch (Exception e) {
            abrir(detalhesDoApp());
        }
        call.resolve();
    }

    /** Tela do app nas configurações (notificações, bateria, permissões). */
    @PluginMethod
    public void abrirConfiguracoes(PluginCall call) {
        abrir(detalhesDoApp());
        call.resolve();
    }

    private Intent detalhesDoApp() {
        return new Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", getContext().getPackageName(), null)
        );
    }

    private void abrir(Intent intent) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getActivity().startActivity(intent);
    }
}
