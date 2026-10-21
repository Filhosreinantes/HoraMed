package br.com.rotinaazul;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Ponte entre o app web e o alarme nativo: agenda os alarmes, informa e pede as
 * permissões, e entrega ao app as doses marcadas como tomadas na tela de alarme.
 */
@CapacitorPlugin(
    name = "Confiabilidade",
    permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notificacoes") }
)
public class ConfiabilidadePlugin extends Plugin {

    @Override
    public void load() {
        Canais.garantir(getContext());
        AlarmeStore.agendarProximo(getContext());
    }

    // ── Alarmes ─────────────────────────────────────────────────────────────

    /** Troca a programação inteira pelos alarmes calculados pelo app. */
    @PluginMethod
    public void agendar(PluginCall call) {
        JSArray alarmes = call.getArray("alarmes");
        AlarmeStore.substituir(getContext(), alarmes == null ? new JSArray() : alarmes);
        call.resolve();
    }

    /** Cancela tudo (ao sair da conta). */
    @PluginMethod
    public void limpar(PluginCall call) {
        AlarmeStore.limpar(getContext());
        call.resolve();
    }

    /** "Adiar" dentro do app: toca de novo daqui a `minutos`. */
    @PluginMethod
    public void adiar(PluginCall call) {
        JSObject alarme = call.getObject("alarme");
        if (alarme == null) {
            call.reject("alarme ausente");
            return;
        }
        AlarmeService.adiar(getContext(), alarme, call.getInt("minutos", AlarmeService.ADIAR_MIN));
        call.resolve();
    }

    /** Doses tomadas na tela de alarme que o app ainda precisa gravar no servidor. */
    @PluginMethod
    public void consumirDoses(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("doses", AlarmeStore.pendentes(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void confirmarDoses(PluginCall call) {
        JSArray chaves = call.getArray("chaves");
        if (chaves != null) AlarmeStore.confirmarPendentes(getContext(), chaves);
        call.resolve();
    }

    // ── Permissões ──────────────────────────────────────────────────────────

    private boolean notificacoesLiberadas() {
        return NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
    }

    /** Em Android 14+ a tela cheia sobre o bloqueio pode vir desligada. */
    private boolean telaCheiaLiberada() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true;
        return getContext().getSystemService(NotificationManager.class).canUseFullScreenIntent();
    }

    @PluginMethod
    public void status(PluginCall call) {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        JSObject ret = new JSObject();
        ret.put("notificacoes", notificacoesLiberadas());
        ret.put("telaCheia", telaCheiaLiberada());
        ret.put("bateria", pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        call.resolve(ret);
    }

    @PluginMethod
    public void pedirNotificacoes(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !notificacoesLiberadas()) {
            requestPermissionForAlias("notificacoes", call, "aoPedirNotificacoes");
            return;
        }
        if (!notificacoesLiberadas()) abrir(configuracoesDeNotificacao());
        call.resolve();
    }

    @PermissionCallback
    private void aoPedirNotificacoes(PluginCall call) {
        // Se o Android não perguntou mais (negado antes), só resta a tela de configurações.
        if (!notificacoesLiberadas()) abrir(configuracoesDeNotificacao());
        call.resolve();
    }

    @PluginMethod
    public void abrirTelaCheia(PluginCall call) {
        try {
            abrir(
                new Intent(
                    Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                    Uri.fromParts("package", getContext().getPackageName(), null)
                )
            );
        } catch (Exception e) {
            abrir(detalhesDoApp());
        }
        call.resolve();
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

    @PluginMethod
    public void abrirConfiguracoes(PluginCall call) {
        abrir(detalhesDoApp());
        call.resolve();
    }

    private Intent configuracoesDeNotificacao() {
        return new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
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
