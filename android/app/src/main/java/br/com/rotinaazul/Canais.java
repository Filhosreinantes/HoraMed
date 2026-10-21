package br.com.rotinaazul;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

/** Canais de notificação do app. Um canal não pode ser alterado depois de criado: para mudar, troque o id. */
final class Canais {

    /** Avisos simples (véspera de consulta e alarmes que ninguém atendeu). */
    static final String LEMBRETES = "lembretes";
    /** Alarme tocando: o som e a vibração em loop são do AlarmeService, não do canal. */
    static final String ALARME = "alarme_tocando";

    private Canais() {}

    static void garantir(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);

        if (nm.getNotificationChannel(LEMBRETES) == null) {
            NotificationChannel canal = new NotificationChannel(
                LEMBRETES,
                "Lembretes e avisos",
                NotificationManager.IMPORTANCE_HIGH
            );
            canal.setDescription("Véspera de consultas e exames, e doses não atendidas.");
            Uri som = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            canal.setSound(
                som,
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            );
            canal.enableVibration(true);
            canal.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(canal);
        }

        if (nm.getNotificationChannel(ALARME) == null) {
            NotificationChannel canal = new NotificationChannel(
                ALARME,
                "Alarme de remédios",
                NotificationManager.IMPORTANCE_HIGH
            );
            canal.setDescription("Tela e som de alarme na hora de cada dose.");
            canal.setSound(null, null);
            canal.enableVibration(false);
            canal.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(canal);
        }
    }
}
