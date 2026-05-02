"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";

interface Emoji {
  emoji: string;
  name: string;
  category: string;
}

// Catálogo enxuto: ~200 emojis populares categorizados.
const EMOJIS: Emoji[] = [
  // Smileys & Pessoas
  { emoji: "😀", name: "feliz", category: "Pessoas" },
  { emoji: "😃", name: "sorriso", category: "Pessoas" },
  { emoji: "😄", name: "riso", category: "Pessoas" },
  { emoji: "😁", name: "feliz dentes", category: "Pessoas" },
  { emoji: "😂", name: "chorando rir", category: "Pessoas" },
  { emoji: "🤣", name: "rolando rir", category: "Pessoas" },
  { emoji: "😊", name: "blush sorriso", category: "Pessoas" },
  { emoji: "😇", name: "anjo", category: "Pessoas" },
  { emoji: "🙂", name: "sorrir", category: "Pessoas" },
  { emoji: "😉", name: "piscar", category: "Pessoas" },
  { emoji: "😍", name: "amor olhos", category: "Pessoas" },
  { emoji: "🥰", name: "apaixonado", category: "Pessoas" },
  { emoji: "😘", name: "beijo", category: "Pessoas" },
  { emoji: "😎", name: "oculos legal", category: "Pessoas" },
  { emoji: "🤓", name: "nerd", category: "Pessoas" },
  { emoji: "🥳", name: "festa", category: "Pessoas" },
  { emoji: "🤔", name: "pensando", category: "Pessoas" },
  { emoji: "🤨", name: "sobrancelha", category: "Pessoas" },
  { emoji: "😐", name: "neutro", category: "Pessoas" },
  { emoji: "😶", name: "sem boca", category: "Pessoas" },
  { emoji: "😏", name: "sorrisinho", category: "Pessoas" },
  { emoji: "😒", name: "desinteressado", category: "Pessoas" },
  { emoji: "🙄", name: "olhos pro alto", category: "Pessoas" },
  { emoji: "😬", name: "nervoso dentes", category: "Pessoas" },
  { emoji: "🤥", name: "mentindo", category: "Pessoas" },
  { emoji: "😴", name: "dormindo", category: "Pessoas" },
  { emoji: "😪", name: "sonolento", category: "Pessoas" },
  { emoji: "🤤", name: "babando", category: "Pessoas" },
  { emoji: "😷", name: "mascara", category: "Pessoas" },
  { emoji: "🤒", name: "doente", category: "Pessoas" },
  { emoji: "🥵", name: "calor", category: "Pessoas" },
  { emoji: "🥶", name: "frio", category: "Pessoas" },
  { emoji: "😵", name: "tonto", category: "Pessoas" },
  { emoji: "🤯", name: "explodindo cabeca", category: "Pessoas" },
  { emoji: "🤠", name: "cowboy", category: "Pessoas" },
  { emoji: "🥺", name: "implorando", category: "Pessoas" },
  { emoji: "😢", name: "triste lagrima", category: "Pessoas" },
  { emoji: "😭", name: "chorando", category: "Pessoas" },
  { emoji: "😤", name: "puto", category: "Pessoas" },
  { emoji: "😠", name: "bravo", category: "Pessoas" },
  { emoji: "😡", name: "furioso", category: "Pessoas" },
  { emoji: "🤬", name: "xingando", category: "Pessoas" },
  { emoji: "🤗", name: "abraco", category: "Pessoas" },
  { emoji: "🤝", name: "aperto mao", category: "Pessoas" },
  { emoji: "👋", name: "tchau ola aceno", category: "Pessoas" },
  { emoji: "🙏", name: "obrigado oracao", category: "Pessoas" },
  { emoji: "👍", name: "joinha legal", category: "Pessoas" },
  { emoji: "👎", name: "ruim nao", category: "Pessoas" },
  { emoji: "👌", name: "ok", category: "Pessoas" },
  { emoji: "✌️", name: "paz vitoria", category: "Pessoas" },
  { emoji: "🤞", name: "cruz dedos sorte", category: "Pessoas" },
  { emoji: "👏", name: "palmas aplausos", category: "Pessoas" },
  { emoji: "💪", name: "forca biceps", category: "Pessoas" },
  { emoji: "🤘", name: "rock", category: "Pessoas" },
  { emoji: "👀", name: "olhos olhar", category: "Pessoas" },
  { emoji: "👶", name: "bebe", category: "Pessoas" },
  { emoji: "👨", name: "homem", category: "Pessoas" },
  { emoji: "👩", name: "mulher", category: "Pessoas" },
  { emoji: "👨‍🎓", name: "estudante homem", category: "Pessoas" },
  { emoji: "👩‍🎓", name: "estudante mulher", category: "Pessoas" },
  { emoji: "👨‍💼", name: "empresario", category: "Pessoas" },
  { emoji: "👩‍💼", name: "empresaria", category: "Pessoas" },

  // Comunicação / Símbolos
  { emoji: "💬", name: "balao chat conversa", category: "Comunicação" },
  { emoji: "💭", name: "pensamento balao", category: "Comunicação" },
  { emoji: "🗨️", name: "balao falar", category: "Comunicação" },
  { emoji: "📢", name: "megafone alto-falante", category: "Comunicação" },
  { emoji: "📣", name: "megafone anuncio", category: "Comunicação" },
  { emoji: "🔔", name: "sino notificacao", category: "Comunicação" },
  { emoji: "📩", name: "email enviar", category: "Comunicação" },
  { emoji: "📧", name: "email", category: "Comunicação" },
  { emoji: "✉️", name: "carta envelope", category: "Comunicação" },
  { emoji: "📨", name: "correio entrada", category: "Comunicação" },
  { emoji: "❓", name: "duvida pergunta", category: "Comunicação" },
  { emoji: "❗", name: "exclamacao atencao", category: "Comunicação" },
  { emoji: "💡", name: "ideia lampada", category: "Comunicação" },
  { emoji: "📌", name: "fixar pin", category: "Comunicação" },
  { emoji: "📍", name: "localizacao pin", category: "Comunicação" },

  // Trabalho / Estudo
  { emoji: "📚", name: "livros estudo", category: "Estudo" },
  { emoji: "📖", name: "livro aberto leitura", category: "Estudo" },
  { emoji: "📝", name: "nota anotacao", category: "Estudo" },
  { emoji: "✏️", name: "lapis", category: "Estudo" },
  { emoji: "📒", name: "caderno", category: "Estudo" },
  { emoji: "📓", name: "caderno notas", category: "Estudo" },
  { emoji: "🎓", name: "formatura graduacao", category: "Estudo" },
  { emoji: "📊", name: "grafico estatistica", category: "Estudo" },
  { emoji: "📈", name: "grafico crescimento", category: "Estudo" },
  { emoji: "📉", name: "grafico queda", category: "Estudo" },
  { emoji: "📅", name: "calendario", category: "Estudo" },
  { emoji: "📆", name: "calendario data", category: "Estudo" },
  { emoji: "🗓️", name: "calendario agenda", category: "Estudo" },
  { emoji: "🎯", name: "alvo meta foco", category: "Estudo" },
  { emoji: "💼", name: "trabalho maleta", category: "Estudo" },
  { emoji: "📁", name: "pasta arquivo", category: "Estudo" },
  { emoji: "📂", name: "pasta aberta", category: "Estudo" },
  { emoji: "🔖", name: "marcador bookmark", category: "Estudo" },
  { emoji: "📃", name: "documento pagina", category: "Estudo" },
  { emoji: "📄", name: "documento", category: "Estudo" },
  { emoji: "🧠", name: "cerebro", category: "Estudo" },

  // Conquistas / Diversão
  { emoji: "🏆", name: "trofeu vencedor", category: "Conquistas" },
  { emoji: "🥇", name: "medalha ouro primeiro", category: "Conquistas" },
  { emoji: "🥈", name: "medalha prata segundo", category: "Conquistas" },
  { emoji: "🥉", name: "medalha bronze terceiro", category: "Conquistas" },
  { emoji: "🎖️", name: "medalha militar", category: "Conquistas" },
  { emoji: "🏅", name: "medalha esportiva", category: "Conquistas" },
  { emoji: "👑", name: "coroa rei", category: "Conquistas" },
  { emoji: "🎉", name: "festa comemoracao", category: "Conquistas" },
  { emoji: "🎊", name: "confete celebrar", category: "Conquistas" },
  { emoji: "🎁", name: "presente caixa", category: "Conquistas" },
  { emoji: "⭐", name: "estrela favorito", category: "Conquistas" },
  { emoji: "🌟", name: "estrela brilhante", category: "Conquistas" },
  { emoji: "✨", name: "estrelas brilho", category: "Conquistas" },
  { emoji: "💫", name: "estrela tonta", category: "Conquistas" },
  { emoji: "🔥", name: "fogo chama", category: "Conquistas" },
  { emoji: "💥", name: "explosao boom", category: "Conquistas" },
  { emoji: "🚀", name: "foguete decolar inicio", category: "Conquistas" },

  // Coração / Emoções
  { emoji: "❤️", name: "coracao vermelho amor", category: "Símbolos" },
  { emoji: "🧡", name: "coracao laranja", category: "Símbolos" },
  { emoji: "💛", name: "coracao amarelo", category: "Símbolos" },
  { emoji: "💚", name: "coracao verde", category: "Símbolos" },
  { emoji: "💙", name: "coracao azul", category: "Símbolos" },
  { emoji: "💜", name: "coracao roxo", category: "Símbolos" },
  { emoji: "🖤", name: "coracao preto", category: "Símbolos" },
  { emoji: "🤍", name: "coracao branco", category: "Símbolos" },
  { emoji: "💔", name: "coracao partido", category: "Símbolos" },
  { emoji: "💖", name: "coracao brilhante", category: "Símbolos" },
  { emoji: "💗", name: "coracao crescendo", category: "Símbolos" },
  { emoji: "💓", name: "batendo coracao", category: "Símbolos" },
  { emoji: "✅", name: "check concluido ok", category: "Símbolos" },
  { emoji: "❌", name: "x errado nao", category: "Símbolos" },
  { emoji: "⛔", name: "proibido", category: "Símbolos" },
  { emoji: "🔒", name: "cadeado bloqueado", category: "Símbolos" },
  { emoji: "🔓", name: "cadeado aberto desbloqueado", category: "Símbolos" },
  { emoji: "🔑", name: "chave acesso", category: "Símbolos" },
  { emoji: "🛡️", name: "escudo protecao", category: "Símbolos" },
  { emoji: "⚠️", name: "alerta cuidado", category: "Símbolos" },
  { emoji: "♥️", name: "coracao naipe", category: "Símbolos" },

  // Tech / Mídia
  { emoji: "📱", name: "celular telefone", category: "Tech" },
  { emoji: "💻", name: "notebook laptop", category: "Tech" },
  { emoji: "⌨️", name: "teclado", category: "Tech" },
  { emoji: "🖥️", name: "computador desktop", category: "Tech" },
  { emoji: "🖱️", name: "mouse computador", category: "Tech" },
  { emoji: "🎬", name: "claquete cinema", category: "Tech" },
  { emoji: "🎥", name: "camera filmagem", category: "Tech" },
  { emoji: "📷", name: "camera fotos", category: "Tech" },
  { emoji: "📹", name: "videocamera", category: "Tech" },
  { emoji: "🎙️", name: "microfone podcast", category: "Tech" },
  { emoji: "🎵", name: "musica nota", category: "Tech" },
  { emoji: "🎶", name: "musica notas", category: "Tech" },
  { emoji: "🎧", name: "fone musica", category: "Tech" },
  { emoji: "📺", name: "tv televisao", category: "Tech" },
  { emoji: "🔗", name: "link conexao", category: "Tech" },
  { emoji: "🌐", name: "globo internet", category: "Tech" },
  { emoji: "🔍", name: "lupa buscar", category: "Tech" },

  // Dinheiro / Negócios
  { emoji: "💰", name: "dinheiro saco", category: "Negócios" },
  { emoji: "💵", name: "dolares notas", category: "Negócios" },
  { emoji: "💴", name: "ienes notas", category: "Negócios" },
  { emoji: "💶", name: "euros notas", category: "Negócios" },
  { emoji: "💷", name: "libras notas", category: "Negócios" },
  { emoji: "💸", name: "dinheiro voando", category: "Negócios" },
  { emoji: "💳", name: "cartao credito", category: "Negócios" },
  { emoji: "🏦", name: "banco", category: "Negócios" },
  { emoji: "🛒", name: "carrinho compras", category: "Negócios" },
  { emoji: "🏷️", name: "etiqueta preco", category: "Negócios" },

  // Diversos
  { emoji: "🌈", name: "arco-iris", category: "Diversos" },
  { emoji: "☀️", name: "sol", category: "Diversos" },
  { emoji: "🌙", name: "lua", category: "Diversos" },
  { emoji: "⚡", name: "raio energia", category: "Diversos" },
  { emoji: "🌍", name: "mundo terra", category: "Diversos" },
  { emoji: "🍕", name: "pizza", category: "Diversos" },
  { emoji: "🍔", name: "hamburguer", category: "Diversos" },
  { emoji: "☕", name: "cafe", category: "Diversos" },
  { emoji: "🍻", name: "cervejas brinde", category: "Diversos" },
  { emoji: "⚽", name: "futebol bola", category: "Diversos" },
  { emoji: "🎮", name: "videogame controle", category: "Diversos" },
  { emoji: "🎲", name: "dado sorte", category: "Diversos" },
  { emoji: "🎨", name: "arte paleta", category: "Diversos" },
  { emoji: "🎭", name: "teatro mascara", category: "Diversos" },
  { emoji: "🚗", name: "carro", category: "Diversos" },
  { emoji: "✈️", name: "aviao viagem", category: "Diversos" },
  { emoji: "🏠", name: "casa", category: "Diversos" },
  { emoji: "🏢", name: "predio escritorio", category: "Diversos" },
];

interface Props {
  value: string;
  onChange: (emoji: string) => void;
  /** Tamanho do botão. Default 32px. */
  size?: number;
}

export function EmojiPicker({ value, onChange, size = 32 }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("[data-emoji-picker]") || target.closest("[data-emoji-trigger]")) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  function handleOpen() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const PICKER_WIDTH = 320;
      const PICKER_HEIGHT = 360;
      let top = rect.bottom + 4;
      let left = rect.left;
      if (left + PICKER_WIDTH > window.innerWidth - 8) {
        left = window.innerWidth - PICKER_WIDTH - 8;
      }
      if (top + PICKER_HEIGHT > window.innerHeight - 8) {
        top = Math.max(8, rect.top - PICKER_HEIGHT - 4);
      }
      setPos({ top, left });
    }
    setOpen(true);
  }

  const filtered = query
    ? EMOJIS.filter((e) =>
        e.name.toLowerCase().includes(query.toLowerCase()),
      )
    : EMOJIS;

  // Agrupa por categoria
  const byCategory = new Map<string, Emoji[]>();
  for (const e of filtered) {
    const arr = byCategory.get(e.category) ?? [];
    arr.push(e);
    byCategory.set(e.category, arr);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        data-emoji-trigger
        onClick={handleOpen}
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-md border border-npb-border bg-npb-bg3 text-base outline-none transition hover:border-npb-gold-dim focus:border-npb-gold-dim"
        aria-label="Selecionar emoji"
      >
        {value || "💬"}
      </button>

      {open &&
        mounted &&
        pos &&
        createPortal(
          <div
            data-emoji-picker
            style={{ position: "fixed", top: pos.top, left: pos.left }}
            className="z-[80] w-80 rounded-lg border border-npb-border bg-npb-bg2 shadow-2xl"
          >
            <div className="border-b border-npb-border p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-npb-text-muted" />
                <input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar emoji…"
                  className="w-full rounded-md border border-npb-border bg-npb-bg3 py-1.5 pl-7 pr-3 text-xs text-npb-text outline-none placeholder:text-npb-text-muted/60 focus:border-npb-gold-dim"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto npb-scrollbar p-2">
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-xs text-npb-text-muted">
                  Nenhum emoji encontrado.
                </p>
              ) : (
                Array.from(byCategory.entries()).map(([cat, emojis]) => (
                  <div key={cat} className="mb-3 last:mb-0">
                    <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-npb-text-muted">
                      {cat}
                    </p>
                    <div className="grid grid-cols-8 gap-0.5">
                      {emojis.map((e) => (
                        <button
                          key={e.emoji + e.name}
                          type="button"
                          onClick={() => {
                            onChange(e.emoji);
                            setOpen(false);
                            setQuery("");
                          }}
                          title={e.name}
                          className="flex h-8 w-8 items-center justify-center rounded text-lg transition hover:bg-npb-bg3"
                        >
                          {e.emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
