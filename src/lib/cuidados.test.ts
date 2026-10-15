import { describe, expect, it } from "vitest";
import { gerarSessoes, medicacaoEmUso, resolverSituacoes, formatData } from "./cuidados";

describe("regras de cuidados", () => {
  it("a cada 15 dias por 3 meses gera 6 sessões", () => {
    const s = gerarSessoes("2026-10-01", "quinzenal", 3);
    expect(s).toHaveLength(6);
    expect(s[1]).toBe("2026-10-15");
  });
  it("semanal começa no dia da semana escolhido", () => {
    const s = gerarSessoes("2026-10-15", "semanal", 3, 1); // segunda
    expect(s[0]).toBe("2026-10-19");
    expect(s).toHaveLength(12);
  });
  it("medicação sem fim está em uso; fim passado está encerrada", () => {
    expect(medicacaoEmUso({ fim: undefined } as never, "2026-10-15")).toBe(true);
    expect(medicacaoEmUso({ fim: "2026-10-01" } as never, "2026-10-15")).toBe(false);
  });
  it("evento não altera o original mas define a situação", () => {
    const r = resolverSituacoes([
      { id: "a", pessoaId: "p", criadoEm: "1", titulo: "x", situacao: "proximo" },
      { id: "b", pessoaId: "p", criadoEm: "2", titulo: "y", evento: true, parentId: "a", situacao: "faltou" },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].situacao).toBe("faltou");
  });
  it("data em português", () => {
    expect(formatData("2026-10-16")).toBe("16 de outubro de 2026");
  });
});
