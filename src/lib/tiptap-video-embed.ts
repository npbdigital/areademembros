/**
 * Extensão Tiptap pra incorporar vídeos do YouTube/Vimeo INLINE no fluxo do
 * texto — onde o cursor estiver, fica o vídeo. Substitui o antigo modelo do
 * "video_url no fim do post".
 *
 * O storage é HTML padrão: `<iframe src="...embed/..." class="...">`. O
 * sanitizador (`sanitizePostHtml`) tem allowlist pros domínios de embed,
 * então não vira XSS.
 */

import { Node, mergeAttributes } from "@tiptap/core";

export interface VideoEmbedAttrs {
  src: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    videoEmbed: {
      setVideoEmbed: (options: VideoEmbedAttrs) => ReturnType;
    };
  }
}

export const VideoEmbed = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (el) => el.getAttribute("src"),
        renderHTML: (attrs) => (attrs.src ? { src: attrs.src } : {}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "iframe[src*='youtube.com/embed/'], iframe[src*='player.vimeo.com/']",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "iframe",
      mergeAttributes(HTMLAttributes, {
        frameborder: "0",
        allow:
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
        allowfullscreen: "true",
        class: "aspect-video w-full rounded-md border border-npb-border my-3",
      }),
    ];
  },

  addCommands() {
    return {
      setVideoEmbed:
        (options) =>
        ({ commands }) => {
          if (!options.src) return false;
          return commands.insertContent({
            type: this.name,
            attrs: { src: options.src },
          });
        },
    };
  },
});
