package br.com.rotinaazul;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Guarda os alarmes no próprio celular e agenda sempre o próximo com setAlarmClock,
 * que toca no horário mesmo em modo de economia (Doze) e não exige a permissão de
 * "alarme exato". Cada alarme é um JSON:
 *   id, at (ms), kind ("dose" | "insistir" | "adiado" | "vespera"), title, body,
 *   medId, pessoaId, horario, data, medicamento, dosagem, pessoa
 */
final class AlarmeStore {

    private static final String PREFS = "alarmes";
    private static final String ALARMES = "alarmes";
    /** Doses marcadas como tomadas no alarme, até o app gravá-las no servidor. */
    private static final String PENDENTES = "pendentes";
    /** Chaves (med|data|horario) de doses tomadas: impedem que o app reagende o 2º aviso. */
    private static final String TOMADAS = "tomadas";

    /** Alarmes que atrasaram mais que isso (celular desligado) não tocam mais. */
    private static final long TOLERANCIA_MS = 10 * 60_000L;
    /** Alarmes dentro dessa janela tocam juntos, numa tela só. */
    static final long JANELA_MS = 30_000L;
    private static final long GUARDAR_TOMADAS_MS = 3 * 24 * 3_600_000L;

    private AlarmeStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONArray ler(Context c, String chave) {
        try {
            return new JSONArray(prefs(c).getString(chave, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static void gravar(Context c, String chave, JSONArray valor) {
        prefs(c).edit().putString(chave, valor.toString()).apply();
    }

    static String chaveDaDose(JSONObject a) {
        return a.optString("medId") + "|" + a.optString("data") + "|" + a.optString("horario");
    }

    static synchronized List<JSONObject> alarmes(Context c) {
        JSONArray arr = ler(c, ALARMES);
        List<JSONObject> out = new ArrayList<>();
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o != null) out.add(o);
        }
        return out;
    }

    private static void gravarAlarmes(Context c, List<JSONObject> lista) {
        gravar(c, ALARMES, new JSONArray(lista));
    }

    /** O app mandou a programação nova: troca tudo, menos os adiados ainda por tocar. */
    static synchronized void substituir(Context c, JSONArray novos) {
        long agora = System.currentTimeMillis();
        JSONArray tomadas = ler(c, TOMADAS);
        List<JSONObject> lista = new ArrayList<>();
        for (int i = 0; i < novos.length(); i++) {
            JSONObject a = novos.optJSONObject(i);
            if (a == null || a.optLong("at") <= agora - TOLERANCIA_MS) continue;
            if (!"vespera".equals(a.optString("kind")) && contem(tomadas, chaveDaDose(a))) continue;
            lista.add(a);
        }
        for (JSONObject a : alarmes(c)) {
            if ("adiado".equals(a.optString("kind")) && a.optLong("at") > agora) lista.add(a);
        }
        gravarAlarmes(c, lista);
        agendarProximo(c);
    }

    static synchronized void limpar(Context c) {
        gravarAlarmes(c, new ArrayList<>());
        gravar(c, PENDENTES, new JSONArray());
        gravar(c, TOMADAS, new JSONArray());
        agendarProximo(c);
    }

    static synchronized void adicionar(Context c, JSONObject alarme) {
        List<JSONObject> lista = alarmes(c);
        lista.add(alarme);
        gravarAlarmes(c, lista);
        agendarProximo(c);
    }

    /** Tira da fila os alarmes que vencem agora (até JANELA_MS à frente) e devolve-os. */
    static synchronized List<JSONObject> retirarVencidos(Context c) {
        long limite = System.currentTimeMillis() + JANELA_MS;
        List<JSONObject> vencidos = new ArrayList<>();
        List<JSONObject> restantes = new ArrayList<>();
        for (JSONObject a : alarmes(c)) {
            if (a.optLong("at") <= limite) vencidos.add(a);
            else restantes.add(a);
        }
        gravarAlarmes(c, restantes);
        return vencidos;
    }

    /** O usuário tocou em "Já tomei": registra para o app gravar e cancela o 2º aviso da dose. */
    static synchronized void marcarTomada(Context c, List<JSONObject> doses) {
        JSONArray pendentes = ler(c, PENDENTES);
        JSONArray tomadas = ler(c, TOMADAS);
        List<String> chaves = new ArrayList<>();
        for (JSONObject a : doses) {
            if (a.optString("medId").isEmpty()) continue;
            String chave = chaveDaDose(a);
            if (chaves.contains(chave)) continue;
            chaves.add(chave);
            try {
                pendentes.put(new JSONObject(a.toString()).put("chave", chave));
                tomadas.put(new JSONObject().put("chave", chave).put("em", System.currentTimeMillis()));
            } catch (JSONException ignorado) {
                // JSON recém-lido: não falha
            }
        }
        gravar(c, PENDENTES, pendentes);
        gravar(c, TOMADAS, podarTomadas(tomadas));

        List<JSONObject> restantes = new ArrayList<>();
        for (JSONObject a : alarmes(c)) {
            if (!chaves.contains(chaveDaDose(a))) restantes.add(a);
        }
        gravarAlarmes(c, restantes);
        agendarProximo(c);
    }

    static synchronized JSONArray pendentes(Context c) {
        return ler(c, PENDENTES);
    }

    static synchronized void confirmarPendentes(Context c, JSONArray chaves) {
        JSONArray pendentes = ler(c, PENDENTES);
        JSONArray restantes = new JSONArray();
        for (int i = 0; i < pendentes.length(); i++) {
            JSONObject p = pendentes.optJSONObject(i);
            if (p != null && !contem(chaves, p.optString("chave"))) restantes.put(p);
        }
        gravar(c, PENDENTES, restantes);
    }

    private static JSONArray podarTomadas(JSONArray tomadas) {
        long limite = System.currentTimeMillis() - GUARDAR_TOMADAS_MS;
        JSONArray out = new JSONArray();
        for (int i = 0; i < tomadas.length(); i++) {
            JSONObject t = tomadas.optJSONObject(i);
            if (t != null && t.optLong("em") > limite) out.put(t);
        }
        return out;
    }

    private static boolean contem(JSONArray lista, String chave) {
        for (int i = 0; i < lista.length(); i++) {
            Object v = lista.opt(i);
            String s = v instanceof JSONObject ? ((JSONObject) v).optString("chave") : String.valueOf(v);
            if (chave.equals(s)) return true;
        }
        return false;
    }

    /** Agenda no sistema o alarme mais próximo (ou cancela, se a fila está vazia). */
    static synchronized void agendarProximo(Context c) {
        long agora = System.currentTimeMillis();
        List<JSONObject> lista = new ArrayList<>();
        long proximo = Long.MAX_VALUE;
        for (JSONObject a : alarmes(c)) {
            long at = a.optLong("at");
            if (at < agora - TOLERANCIA_MS) continue;
            lista.add(a);
            proximo = Math.min(proximo, at);
        }
        gravarAlarmes(c, lista);

        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent disparo = PendingIntent.getBroadcast(
            c,
            0,
            new Intent(c, AlarmeReceiver.class).setAction(AlarmeReceiver.ACAO_DISPARAR),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        if (proximo == Long.MAX_VALUE) {
            am.cancel(disparo);
            return;
        }
        // Tocar no ícone de alarme da barra de status abre o app.
        PendingIntent abrir = PendingIntent.getActivity(
            c,
            0,
            new Intent(c, MainActivity.class),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        am.setAlarmClock(new AlarmManager.AlarmClockInfo(Math.max(proximo, agora + 1), abrir), disparo);
    }
}
