package br.com.rotinaazul;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.core.content.ContextCompat;
import java.util.List;
import org.json.JSONObject;

/** Tela de alarme: aparece sobre o bloqueio, com o som tocando até o usuário responder. */
public class AlarmeActivity extends Activity {

    private final BroadcastReceiver receptor = new BroadcastReceiver() {
        @Override
        public void onReceive(Context c, Intent i) {
            if (AlarmeService.ACAO_FECHAR.equals(i.getAction())) finish();
            else montar();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        IntentFilter filtro = new IntentFilter();
        filtro.addAction(AlarmeService.ACAO_FECHAR);
        filtro.addAction(AlarmeService.ACAO_ATUALIZAR);
        ContextCompat.registerReceiver(this, receptor, filtro, ContextCompat.RECEIVER_NOT_EXPORTED);
        montar();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        montar();
    }

    @Override
    protected void onDestroy() {
        unregisterReceiver(receptor);
        super.onDestroy();
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private void montar() {
        String json = AlarmeService.atual;
        if (json == null) {
            // O alarme já foi respondido: nada para mostrar.
            finish();
            return;
        }
        List<JSONObject> alarmes = AlarmeReceiver.doJson(json);
        if (alarmes.isEmpty()) {
            finish();
            return;
        }

        LinearLayout raiz = new LinearLayout(this);
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setGravity(Gravity.CENTER);
        raiz.setBackgroundColor(0xFF2C4A6B);
        raiz.setPadding(dp(24), dp(48), dp(24), dp(32));

        TextView rotulo = texto("ALARME", 14, Typeface.BOLD, 0xFFB8D4F0);
        rotulo.setLetterSpacing(0.2f);
        raiz.addView(rotulo);

        TextView titulo = texto(AlarmeService.titulo(alarmes), 30, Typeface.BOLD, Color.WHITE);
        titulo.setPadding(0, dp(12), 0, dp(12));
        raiz.addView(titulo);

        raiz.addView(texto(AlarmeService.corpo(alarmes), 20, Typeface.NORMAL, 0xFFE6EEF7));

        View espaco = new View(this);
        raiz.addView(espaco, new LinearLayout.LayoutParams(1, 0, 1f));

        if (AlarmeService.temDose(alarmes)) {
            raiz.addView(botao("Já tomei", 0xFF2E9E5B, Color.WHITE, AlarmeService.ACAO_TOMEI));
            raiz.addView(
                botao("Adiar " + AlarmeService.ADIAR_MIN + " minutos", 0x00000000, Color.WHITE, AlarmeService.ACAO_ADIAR)
            );
        }
        raiz.addView(botao("Parar alarme", 0x00000000, 0xFFB8D4F0, AlarmeService.ACAO_PARAR));

        setContentView(raiz);
    }

    private TextView texto(String s, int sp, int estilo, int cor) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTypeface(Typeface.DEFAULT, estilo);
        t.setTextColor(cor);
        t.setGravity(Gravity.CENTER);
        return t;
    }

    private Button botao(String rotulo, int fundo, int cor, String acao) {
        Button b = new Button(this);
        b.setText(rotulo);
        b.setAllCaps(false);
        b.setTextSize(20);
        b.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        b.setTextColor(cor);
        GradientDrawable forma = new GradientDrawable();
        forma.setCornerRadius(dp(16));
        forma.setColor(fundo);
        if (fundo == 0x00000000) forma.setStroke(dp(2), cor);
        b.setBackground(forma);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(64)
        );
        lp.topMargin = dp(12);
        b.setLayoutParams(lp);
        b.setOnClickListener(v -> {
            startService(new Intent(this, AlarmeService.class).setAction(acao));
            finish();
        });
        return b;
    }
}
