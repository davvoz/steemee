/**
 * Espressioni regolari centralizzate per l'intera applicazione
 */

// URL generali
export const URL_REGEX = /(https?:\/\/[^\s]+)/g;

// Immagini - più completo rispetto al vecchio approccio
export const IMAGE_REGEX = /(https?:\/\/.*\.(?:tiff?|jpe?g|gif|png|svg|ico|heic|webp|avif))(.*)/gim;

// Markdown image
export const MARKDOWN_IMAGE_REGEX = /!\[.*?\]\((https?:\/\/[^)]+)\)/gi;

// HTML img tag
export const HTML_IMAGE_REGEX = /<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/gi;

// Estrazione semplice src da HTML img
export const IMG_SRC_REGEX = /<img[^>]+src=["'](https?:\/\/[^"']+)["']/i;

// Link con estensione immagine
export const IMAGE_URL_REGEX = /(https?:\/\/\S+\.(?:jpe?g|png|gif|webp|svg|bmp|avif)(\?[^\s<>"']*)?)/gi;

// Estensioni file immagine
export const IMAGE_EXTENSION_REGEX = /\.(jpe?g|png|gif|webp|svg|bmp|avif)(\?.*)?$/i;

// IPFS links
export const IPFS_REGEX = /^https?:\/\/[^/]+\/(ip[fn]s)\/([^/?#]+)/gim;

// Post, Link, e Community Regex
export const POST_REGEX = /^https?:\/\/(.*)\/(.*)\/(@[\w.\d-]+)\/(.*)/i;
export const CCC_REGEX = /^https?:\/\/(.*)\/ccc\/([\w.\d-]+)\/(.*)/i;
export const MENTION_REGEX = /^https?:\/\/(.*)\/(@[\w.\d-]+)$/i;
export const TOPIC_REGEX = /^https?:\/\/(.*)\/(trending|hot|created|promoted|muted|payout)\/(.*)$/i;

// Link interni
export const INTERNAL_MENTION_REGEX = /^\/@[\w.\d-]+$/i;
export const INTERNAL_TOPIC_REGEX = /^\/(trending|hot|created|promoted|muted|payout)\/(.*)$/i;
export const INTERNAL_POST_TAG_REGEX = /(.*)\/(@[\w.\d-]+)\/(.*)/i;
export const INTERNAL_POST_REGEX = /^\/(@[\w.\d-]+)\/(.*)$/i;
export const CUSTOM_COMMUNITY_REGEX = /^https?:\/\/(.*)\/c\/(hive-\d+)(.*)/i;

// Servizi video - YouTube
export const YOUTUBE_REGEX = {
  standard: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(?:[&?].*)?/gi,
  short: /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:[?].*)?/gi,
  embed: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(?:[?].*)?/gi,
  shorts: /(?:youtube.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu.be\/)([^"&?\/\s]{11})/g
};
export const YOUTUBE_EMBED_REGEX = /^(https?:)?\/\/www.youtube.com\/(embed|shorts)\/.*/i;

// Vimeo
export const VIMEO_REGEX = {
  standard: /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)(?:[?&#].*)?/gi,
  player: /(?:https?:\/\/)?player\.vimeo\.com\/video\/(\d+)(?:[?&#].*)?/gi,
  general: /(https?:\/\/)?(www\.)?(?:vimeo)\.com.*(?:videos|video|channels|)\/([\d]+)/i
};
export const VIMEO_EMBED_REGEX = /https:\/\/player\.vimeo\.com\/video\/([0-9]+)/;

// Altre piattaforme video
export const BITCHUTE_REGEX = /^(?:https?:\/\/)?(?:www\.)?bitchute.com\/(?:video|embed)\/([a-z0-9]+)/i;
export const D_TUBE_REGEX = /(https?:\/\/d.tube.#!\/v\/)(\w+)\/(\w+)/g;
export const D_TUBE_REGEX2 = /(https?:\/\/d.tube\/v\/)(\w+)\/(\w+)/g;
export const D_TUBE_EMBED_REGEX = /^https:\/\/emb.d.tube\/.*/i;
export const TWITCH_REGEX = /https?:\/\/(?:www.)?twitch.tv\/(?:(videos)\/)?([a-zA-Z0-9][\w]{3,24})/i;
export const TWITCH_EMBED_REGEX = /^(https?:)?\/\/player.twitch.tv\/.*/i;
export const DAPPLR_REGEX = /^(https?:)?\/\/[a-z]*\.dapplr.in\/file\/dapplr-videos\/.*/i;
export const TRUVVL_REGEX = /^https?:\/\/embed.truvvl.com\/(@[\w.\d-]+)\/(.*)/i;

// LBRY, Odysee e altri
export const LBRY_REGEX = /^(https?:)?\/\/lbry.tv\/\$\/embed\/.*/i;
export const ODYSEE_REGEX = /^(https?:)?\/\/odysee.com\/\$\/embed\/.*/i;
export const SKATEHIVE_IPFS_REGEX = /^https?:\/\/ipfs\.skatehive\.app\/ipfs\/([^/?#]+)/i;
export const ARCH_REGEX = /^(https?:)?\/\/archive.org\/embed\/.*/i;

// 3Speak
export const SPEAK_REGEX = /(?:https?:\/\/(?:3speak.([a-z]+)\/watch\?v=)|(?:3speak.([a-z]+)\/embed\?v=))([A-Za-z0-9\_\-\.\/]+)(&.*)?/i;
export const SPEAK_EMBED_REGEX = /^(https?:)?\/\/3speak.([a-z]+)\/embed\?.*/i;

// Social media
export const TWITTER_REGEX = /(?:https?:\/\/(?:(?:twitter\.com\/(.*?)\/status\/(.*))))/gi;

// Audio e musica
export const SPOTIFY_REGEX = /^https:\/\/open\.spotify\.com\/playlist\/(.*)?$/gi;
export const SPOTIFY_EMBED_REGEX = /^https:\/\/open\.spotify\.com\/(embed|embed-podcast)\/(playlist|show|episode|track|album)\/(.*)/i;
export const SOUNDCLOUD_EMBED_REGEX = /^https:\/\/w.soundcloud.com\/player\/.*/i;

// Altre piattaforme meno comuni
export const RUMBLE_REGEX = /^https:\/\/rumble.com\/embed\/([a-zA-Z0-9-]+)\/\?pub=\w+/;
export const BRIGHTEON_REGEX = /^https?:\/\/(www\.)?brighteon\.com\/(?:embed\/)?(.*[0-9].*)/i;
export const VIMM_EMBED_REGEX = /^https:\/\/www.vimm.tv\/.*/i;
export const BRAND_NEW_TUBE_REGEX = /^https:\/\/brandnewtube\.com\/embed\/[a-z0-9]+$/i;
export const LOOM_REGEX = /^(https?:)?\/\/www.loom.com\/share\/(.*)/i;
export const LOOM_EMBED_REGEX = /^(https?:)?\/\/www.loom.com\/embed\/(.*)/i;
export const AUREAL_EMBED_REGEX = /^(https?:\/\/)?(www\.)?(?:aureal-embed)\.web\.app\/([0-9]+)/i;

// HTML e contenuti speciali
export const ENTITY_REGEX = /&([a-z0-9]+|#[0-9]{1,6}|#x[0-9a-fA-F]{1,6});/ig;
export const SECTION_REGEX = /\B(\#[\da-zA-Z-_]+\b)(?!;)/i;

// Altri pattern comuni in base al progetto di origine
export const MENTION_TAG_REGEX = /(^|\s)@([a-z][-\.a-z\d]+[a-z\d])/gi;
export const HASHTAG_REGEX = /(?:^|\s)(#[a-z\d-]+)/gi;
export const BLOCKQUOTE_REGEX = /<blockquote>([\s\S]*?)<\/blockquote>/g;
export const EMBED_MARKER_REGEX = /~~~ embed:([A-Za-z0-9_\-\/\.\?=]+) ([a-z]+) ~~~([\n\r]*)/i;
export const VIDEO_EMBED_REGEX = /(https?:)\/\/(?:www\.)?(?:(youtube\.com\/watch\?v=)|(?:youtu.be\/)|(?:vimeo\.com\/))([a-zA-Z0-9_-]+)/i;
export const TEXT_URL_REGEX = /(https?:\/\/[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-z]{2,63}\b[-a-zA-Z0-9@:%_+.~#?&\/=]*)/gi;
export const EMAIL_REGEX = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;

// NSFW flag detector per contenuto
export const NSFW_REGEX = /nsfw|nude|explicit|sex|pornography|adult|xxx|porn|18\+/i;

// Estrattori di metadati
export const TITLE_REGEX = /<title>([^<]+)<\/title>/i;
export const DESC_REGEX = /<meta[^>]*name="description"[^>]*content="([^"]+)"[^>]*>/i;
export const OG_TITLE_REGEX = /<meta[^>]*property="og:title"[^>]*content="([^"]+)"[^>]*>/i;
export const OG_DESC_REGEX = /<meta[^>]*property="og:description"[^>]*content="([^"]+)"[^>]*>/i;
export const OG_IMAGE_REGEX = /<meta[^>]*property="og:image"[^>]*content="([^"]+)"[^>]*>/i;

// Utilità
export const WHITESPACE_REGEX = /^\s*$/;
export const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/gi;
export const BBCODE_REGEX = /\[([a-z]+)(?:=[^\]]*)?]([\s\S]*?)\[\/\1]/gi;

// Regex specifica per CDN Steem con hash IPFS
export const STEEM_CDN_HASH_REGEX = /https?:\/\/(?:cdn\.)?steemitimages\.com\/DQ[a-zA-Z0-9]+\/([^"\s)]+)/gi;