/**
 * The note every new account starts with.
 *
 * The note body is stored HTML, rendered by the frontend's editor — so it may
 * only use what that editor can hold. TipTap drops anything it has no
 * extension for (inline `style`, font and colour marks), which is what made the
 * 2022 version's "Various Font and Sizes" and "Colored Text" demos show plain
 * text. This one sticks to headings, lists, emphasis, code, quotes, sub/superscript
 * and links, and a test keeps it that way.
 *
 * The page heading is the note's title, so the body starts at `h2`.
 *
 * S2-18 — no image: the previous version embedded one by this API's absolute
 * URL, which both baked a host name into every user's document and was refused
 * by the browser (cross-origin).
 * S2-19 — links are built from the frontend's origin, and none of them go to
 * `/note/create-new`: that route used to create a note on every visit.
 */
export const welcomeNote = (frontendUrl: string): string => {
  const privacy = `${frontendUrl}/privacy`
  const settings = `${frontendUrl}/settings`

  return [
    `<p>This note is a two-minute tour. Click anywhere in it and edit — your changes save themselves.</p>`,
    `<h2>Get going</h2>`,
    `<ol>`,
    `<li><p><strong>Name your notes.</strong> The title and one-line description sit above the editor, and search looks through both.</p></li>`,
    `<li><p><strong>File them in a section.</strong> Make a section with the folder button next to “New note”, then press “File” under a note’s title.</p></li>`,
    `<li><p><strong>Tag across sections.</strong> Press “+ Tag” to group notes by what they are about, wherever they live.</p></li>`,
    `<li><p><strong>Watch it save.</strong> The “Saved” mark above the editor confirms your latest change is stored.</p></li>`,
    `<li><p><strong>Publish on purpose.</strong> A note is private until you press Publish, and Unpublish takes it back.</p></li>`,
    `</ol>`,
    `<h2>What the editor can do</h2>`,
    `<p><strong>Bold</strong>, <em>italic</em>, <u>underline</u> and <s>strikethrough</s>; <code>inline code</code>; and <a href="${privacy}">links</a>.</p>`,
    `<p>Water is H<sub>2</sub>O, and the area of a square is side<sup>2</sup>.</p>`,
    `<blockquote><p>A stitch in time saves nine.</p></blockquote>`,
    `<p>Headings, lists, alignment and pictures are on the toolbar.</p>`,
    `<h2>Make it yours</h2>`,
    `<p>Add your name and a short biography in <a href="${settings}">Settings</a>; they appear on notes you publish. Rewrite or clear this note whenever you like — it stays in your list.</p>`,
  ].join('')
}
