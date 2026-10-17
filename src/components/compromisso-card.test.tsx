import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompromissoCard } from "./compromisso-card";
import type { Item } from "@/lib/cuidados";

const { salvarRegistros } = vi.hoisted(() => ({ salvarRegistros: vi.fn() }));
vi.mock("@/lib/app-store", () => ({ useApp: () => ({ salvarRegistros }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("acompanhamento no card", () => {
  const item: Item = { id: "consulta-original", pessoaId: "tesouro", criadoEm: "2026-10-17", titulo: "Consulta", cuidado: "Consulta", profissional: "Dr. Marcelo", especialidade: "Nefrologista", situacao: "proximo", _evento: undefined };
  it.each([ ["Compareceu", "feito"], ["Faltou", "faltou"] ])("%s salva um evento novo sem modificar o compromisso", async (botao, situacao) => {
    salvarRegistros.mockResolvedValue(true);
    render(<CompromissoCard item={item} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Minha anotação" } });
    fireEvent.click(screen.getByRole("button", { name: botao }));
    await waitFor(() => expect(salvarRegistros).toHaveBeenCalledTimes(1));
    const evento = salvarRegistros.mock.calls[0]?.[0]?.[0];
    expect(evento).toMatchObject({ parentId: "consulta-original", evento: true, pessoaId: "tesouro", situacao, observacaoAcompanhamento: "Minha anotação", titulo: "Consulta com Dr. Marcelo (Nefrologista)" });
    expect(evento.id).not.toBe(item.id);
    expect(item.situacao).toBe("proximo");
  });
  it("não permite um novo resultado em compromisso concluído", () => {
    render(<CompromissoCard item={{ ...item, situacao: "feito" }} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.queryByRole("button", { name: "Faltou" })).toBeNull();
    expect(salvarRegistros).not.toHaveBeenCalled();
  });
});