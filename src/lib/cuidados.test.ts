import { describe, expect, it } from "vitest";
import { gerarSessoes, medicacaoEmUso, resolverSituacoes, formatData, ordenarPorDataHora, compromissoPendente, tituloEvento, medicacoesComLembrete, horarioDoLog, doseRegistrada, lembretesDoDia, avisosDeVespera, type Dados } from "./cuidados";

describe("regras de cuidados", () => {
  const registro = (dados: Partial<Dados>): Dados => ({ id: "a", pessoaId: "p", criadoEm: "2026-10-17", titulo: "Predsin", ...dados });
  it("ordena por data e depois hora, sem alterar a lista original", () => {
    const lista = [registro({ id: "tarde", data: "2026-10-18", hora: "14:00" }), registro({ id: "antes", data: "2026-10-17", hora: "20:00" }), registro({ id: "cedo", data: "2026-10-18", hora: "08:00" })];
    expect(ordenarPorDataHora(lista).map((d) => d.id)).toEqual(["antes", "cedo", "tarde"]);
    expect(lista[0]?.id).toBe("tarde");
  });
  it("inclui medicação contínua ou vigente, mesmo após registrar acompanhamento", () => {
    expect(compromissoPendente(registro({ cuidado: "Medicação", situacao: "feito" }), "2026-10-17")).toBe(true);
    expect(compromissoPendente(registro({ cuidado: "Medicação", fim: "2026-10-20" }), "2026-10-17")).toBe(true);
    expect(compromissoPendente(registro({ cuidado: "Medicação", fim: "2026-10-17" }), "2026-10-17")).toBe(true);
    expect(compromissoPendente(registro({ cuidado: "Medicação", fim: "2026-10-16" }), "2026-10-17")).toBe(false);
  });
  it("inclui consultas, exames e terapias pendentes, inclusive sem situação", () => {
    for (const cuidado of ["Consulta", "Exame", "Terapia"] as const) {
      expect(compromissoPendente(registro({ cuidado }))).toBe(true);
      expect(compromissoPendente(registro({ cuidado, situacao: "faltou" }))).toBe(false);
    }
  });
  it("ordena medicação por início e menor horário da lista", () => {
    const lista = [registro({ id: "tarde", inicio: "2026-10-17", horarios: ["20:00", "14:00"] }), registro({ id: "cedo", inicio: "2026-10-17", horarios: ["20:00", "08:00"] })];
    expect(ordenarPorDataHora(lista).map((d) => d.id)).toEqual(["cedo", "tarde"]);
  });
  it("gera título de consulta com profissional e especialidade", () => {
    expect(tituloEvento(registro({ cuidado: "Consulta", profissional: "Dr. Marcelo", especialidade: "Nefrologista" }), "feito")).toBe("Consulta com Dr. Marcelo (Nefrologista)");
    expect(tituloEvento(registro({ cuidado: "Consulta", profissional: "Dr. Marcelo" }), "faltou")).toBe("Consulta com Dr. Marcelo");
  });
  it("gera título de medicação com nome do medicamento", () => {
    expect(tituloEvento(registro({ cuidado: "Medicação", medicamento: "Predsin" }), "feito")).toBe("Medicação · Predsin");
  });
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
    expect(r[0]?.situacao).toBe("faltou");
  });
  it("data em português", () => {
    expect(formatData("2026-10-16")).toBe("16 de outubro de 2026");
  });
});

describe("lembretes de medicação", () => {
  const med = (dados: Partial<Dados> = {}): Dados => ({
    id: "m", pessoaId: "p", criadoEm: "2026-10-01T08:00:00", titulo: "Medicação · Predsin",
    cuidado: "Medicação", horarios: ["08:00", "20:00"], inicio: "2026-10-10", ...dados,
  });
  const evento = (dados: Partial<Dados>): Dados => ({
    id: `e-${dados.criadoEm}`, pessoaId: "p", titulo: "x", evento: true, parentId: "m", criadoEm: "2026-10-15T09:00:00", ...dados,
  });
  const ids = (todos: Dados[], hoje: string) => medicacoesComLembrete(todos, hoje).map((d) => d.id);

  it("respeita início e fim da medicação", () => {
    expect(ids([med()], "2026-10-09")).toEqual([]);
    expect(ids([med()], "2026-10-10")).toEqual(["m"]);
    expect(ids([med({ fim: "2026-10-20" })], "2026-10-20")).toEqual(["m"]);
    expect(ids([med({ fim: "2026-10-20" })], "2026-10-21")).toEqual([]);
  });
  it("uso contínuo continua avisando depois de 28 dias", () => {
    expect(ids([med()], "2027-03-01")).toEqual(["m"]);
  });
  it("para de avisar quando o último acompanhamento cancela, e volta se for retomada", () => {
    const cancelou = evento({ cuidado: "Medicação", situacao: "cancelado", criadoEm: "2026-10-15T09:00:00" });
    expect(ids([med(), cancelou], "2026-10-16")).toEqual([]);
    const retomou = evento({ cuidado: "Medicação", situacao: "feito", criadoEm: "2026-10-17T09:00:00" });
    expect(ids([med(), cancelou, retomou], "2026-10-18")).toEqual(["m"]);
  });
  it("registro de dose tomada não desfaz o cancelamento", () => {
    const cancelou = evento({ cuidado: "Medicação", situacao: "cancelado", criadoEm: "2026-10-15T09:00:00" });
    const tomou = evento({ titulo: "Tomou: Predsin (08:00)", criadoEm: "2026-10-16T08:00:00" });
    expect(ids([med(), cancelou, tomou], "2026-10-16")).toEqual([]);
  });
  it("só avisa nos dias da semana escolhidos", () => {
    // 2026-10-19 é segunda (1); 2026-10-20 é terça (2).
    expect(ids([med({ diasSemana: [1, 3, 5] })], "2026-10-19")).toEqual(["m"]);
    expect(ids([med({ diasSemana: [1, 3, 5] })], "2026-10-20")).toEqual([]);
    expect(ids([med({ diasSemana: [] })], "2026-10-20")).toEqual(["m"]);
  });
  it("ignora medicação sem horários e outros cuidados", () => {
    expect(ids([med({ horarios: [] }), med({ id: "c", cuidado: "Consulta" })], "2026-10-16")).toEqual([]);
  });
});

describe("doses registradas e segundo aviso", () => {
  const med: Dados = {
    id: "m", pessoaId: "p", criadoEm: "2026-10-01T08:00:00", titulo: "Medicação · Predsin",
    cuidado: "Medicação", medicamento: "Predsin", horarios: ["08:00", "20:00"], inicio: "2026-10-01",
  };
  const log = (titulo: string, extra: Partial<Dados> = {}): Dados => ({
    id: titulo, pessoaId: "p", criadoEm: "2026-10-18T09:00:00", titulo, evento: true, parentId: "m", data: "2026-10-18", ...extra,
  });
  const resumo = (todos: Dados[]) => lembretesDoDia(todos, "2026-10-18").map((l) => `${l.tipo}@${l.hora}`);

  it("atraso de 08:00 para 20:00 não marca a dose das 20:00", () => {
    const atrasou = log("Atrasou: Predsin (08:00 -> 20:00)");
    expect(horarioDoLog(atrasou)).toBe("08:00");
    expect(doseRegistrada([atrasou], "m", "2026-10-18", "08:00")).toBeTruthy();
    expect(doseRegistrada([atrasou], "m", "2026-10-18", "20:00")).toBeUndefined();
  });
  it("usa o campo horario quando existe", () => {
    expect(horarioDoLog(log("Tomou: Predsin", { horario: "20:00" }))).toBe("20:00");
  });
  it("avisa no horário e insiste 15 minutos depois enquanto a dose não é registrada", () => {
    expect(resumo([med])).toEqual(["lembrete@08:00", "insistir@08:15", "lembrete@20:00", "insistir@20:15"]);
    expect(resumo([med, log("Tomou: Predsin (08:00)")])).toEqual(["lembrete@20:00", "insistir@20:15"]);
  });
  it("não insiste depois da meia-noite", () => {
    expect(resumo([{ ...med, horarios: ["23:50"] }])).toEqual(["lembrete@23:50"]);
  });
});

describe("editar/excluir sem alterar o original", () => {
  const med: Dados = {
    id: "m", pessoaId: "p", criadoEm: "2026-10-01T08:00:00", titulo: "Medicação · Predsin",
    cuidado: "Medicação", medicamento: "Predsin", horarios: ["08:00"], inicio: "2026-10-01", fim: "2026-10-30",
  };
  const mudanca = (acao: "editar" | "excluir", criadoEm: string, alteracoes?: Partial<Dados>): Dados => ({
    id: `x-${criadoEm}`, pessoaId: "p", criadoEm, titulo: "x", cuidado: "Medicação", evento: true, parentId: "m", acao, alteracoes,
  });

  it("aplica as edições em ordem e preserva o registro original", () => {
    const todos = [
      med,
      mudanca("editar", "2026-10-05T10:00:00", { horarios: ["09:00", "21:00"], fim: "" }),
      mudanca("editar", "2026-10-03T10:00:00", { dosagem: "5 ml", horarios: ["07:00"] }),
    ];
    const [r] = resolverSituacoes(todos);
    expect(r?.horarios).toEqual(["09:00", "21:00"]);
    expect(r?.dosagem).toBe("5 ml");
    expect(r?.fim).toBe("");
    expect(r?.situacao).toBeUndefined(); // edição não é acompanhamento
    expect(med.horarios).toEqual(["08:00"]);
    expect(medicacoesComLembrete(todos, "2026-11-15").map((d) => d.horarios)).toEqual([["09:00", "21:00"]]);
  });
  it("edição não troca id, pessoa nem tipo", () => {
    const [r] = resolverSituacoes([med, mudanca("editar", "2026-10-05T10:00:00", { id: "outro", pessoaId: "q", cuidado: "Consulta" })]);
    expect([r?.id, r?.pessoaId, r?.cuidado]).toEqual(["m", "p", "Medicação"]);
  });
  it("exclusão esconde a medicação e para os lembretes", () => {
    const todos = [med, mudanca("excluir", "2026-10-05T10:00:00")];
    expect(resolverSituacoes(todos)).toEqual([]);
    expect(medicacoesComLembrete(todos, "2026-10-10")).toEqual([]);
  });
});

describe("aviso 24h antes", () => {
  const consulta = (dados: Partial<Dados> = {}): Dados => ({
    id: "c", pessoaId: "p", criadoEm: "2026-10-01T08:00:00", titulo: "Consulta · Pediatria", cuidado: "Consulta",
    data: "2026-10-20", hora: "14:30", ...dados,
  });
  const avisos = (todos: Dados[], dia: string) => avisosDeVespera(todos, dia).map((a) => `${a.item.id}@${a.hora}`);

  it("avisa na véspera, no mesmo horário do compromisso", () => {
    expect(avisos([consulta()], "2026-10-19")).toEqual(["c@14:30"]);
    expect(avisos([consulta()], "2026-10-18")).toEqual([]);
    expect(avisos([consulta()], "2026-10-20")).toEqual([]);
  });
  it("sem horário, avisa às 09:00 da véspera; vale para exames e não para terapias", () => {
    expect(avisos([consulta({ hora: undefined }), consulta({ id: "e", cuidado: "Exame" }), consulta({ id: "t", cuidado: "Terapia" })], "2026-10-19"))
      .toEqual(["c@09:00", "e@14:30"]);
  });
  it("não avisa se já foi cancelado ou registrado", () => {
    const cancelou: Dados = { id: "ev", pessoaId: "p", criadoEm: "2026-10-10T09:00:00", titulo: "x", cuidado: "Consulta", evento: true, parentId: "c", situacao: "cancelado" };
    expect(avisos([consulta(), cancelou], "2026-10-19")).toEqual([]);
  });
  it("atravessa o fim do mês", () => {
    expect(avisos([consulta({ data: "2026-11-01" })], "2026-10-31")).toEqual(["c@14:30"]);
  });
});
