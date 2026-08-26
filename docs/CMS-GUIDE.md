# Managing 3lines.com.sa

For the person updating the website. No technical knowledge needed.

---

## Getting in

Open **http://localhost:3200/admin** and enter the password.

> Once the site is live on Cloudflare this becomes `https://3lines.com.sa/admin`.
> Until then it only runs on the machine where it was started.

---

## The screens

| Screen | What you change | Where it appears |
|---|---|---|
| **Companies** | The four group companies — name, tagline, link. You can add a fifth, reorder them, or remove one | Homepage |
| **Services** | All ten service cards — title and description. One edit updates the homepage and the Services page together | Homepage and the Services page |
| **Partners** | All 39 partners and clients — name and caption | Partners page |
| **News** | The news posts — create one, delete one, reorder them, change the card image, and edit the headline, category and date | Homepage and the Newsroom |
| **Shared bands** | The careers call-to-action and the contact icon strip that repeat at the foot of nearly every page — edited once, updated everywhere | Almost every page |
| **Images** | The photo and logo library. Upload new pictures here | Everywhere |
| **Navigation** | The header links, the big menu, the footer columns and both logo marks | Every page |
| **Interface text** | The design's own words — menu buttons, the theme toggle, the 404 page, screen-reader labels | Every page |
| **Site info** | Company name and description, address, phone, email, CR and VAT numbers, the footer badge and copyright, page-title branding | Footer, contact strip, and what Google shows about the company |
| **Pages & SEO** | Everything on every page: the words, the links, the images, the statistics numbers, the order of sections — plus the title and description Google displays | Everywhere |

---

## Making a change

1. Open a section from the left.
2. Click the card you want to change. (On **Pages & SEO**, click **Edit** on a row, then a band.)
3. Type the **English** in the top box and the **Arabic** in the box directly underneath.
4. Click **Save changes**.
5. Check the **preview on the right** — it updates by itself after each save.
6. Click **Publish**, then **Confirm — publish live**.

Publish needs two clicks on purpose, so it can't happen by accident.

### Rearranging a page

Open the page under **Pages & SEO** and open a band. **↑ Earlier / ↓ Later** move it,
**Delete** removes it (it asks twice), and **+ Add content** inside a section adds a new
paragraph block, statistics row, fact strip and so on. **+ Add section** at the bottom adds a
whole new section. Where a band holds a list — blurbs, statistics, slides — the numbered
buttons above the text fields add, remove and reorder the items.

These changes apply immediately (no Save needed) and show in the preview; like everything
else, they reach the public site when you **Publish**.

### Links, images and numbers

Inside a band you will also find the link destinations, the images (each with a
**Change image** picker) and, where relevant, the statistics numbers and the map position.
A link to a page of this site is checked when you save — a typo like `/servcies` is
refused rather than published broken.

### A new page

**Pages & SEO → + New page.** Give it an address like `/capabilities` and a title in both
languages. It is created hidden from search engines; write it, preview it, then tick
**Visible to search engines** in its editor when it is ready. Delete works from the same
list — the CMS refuses while the menus, a news post or another page still link to it.

### A new news post

**News → + New post.** The card appears in the newsroom, and a hidden article page is
created with it — write the article under **Pages & SEO**, then switch it on.

---

## Worth knowing

**Both languages are always on screen together.** Every field shows English with Arabic
beneath it, so you can't update one and forget the other.

**Structure is shared between the languages.** Adding, removing or reordering anything
changes English and Arabic together — the Arabic site cannot drift into a different shape.

**Nothing is live until you press Publish.** Saving stores your change; publishing puts it
on the website.

**The preview shows what you have saved, not what is live.** It is the real website page,
not a rough sketch of it — the same code that builds the public site builds what you see
there. Use **EN / AR** to check both languages, and **Phone / Tablet / Desktop** to see how
the page behaves on each. Arabic is worth checking on its own: the whole page mirrors, so a
long headline can wrap differently from the English one.

**To change a picture**, press **Change image** on it. You get every picture the site
holds; search by name, or filter by folder. Click one and it is applied straight away —
then Publish as usual.

**To add a new picture**, go to **Images** and use **Upload an image** at the top. Pick the
file and press Upload; it appears in the library within a second or two and is then
available everywhere. Photographs straight from a phone are fine — they are shrunk
automatically before they are uploaded, so the website stays fast.

**Contact details live in one place.** The email, phone, WhatsApp and address in
**Site info** feed the contact strip on every page, the footer and what Google shows.
Filling in the WhatsApp number is what makes the WhatsApp icon appear.

**Arabic that matches the English is flagged.** If an Arabic field is identical to its
English, the screen says so — usually meaning it hasn't been translated yet. Sometimes it's
correct (a company name like *SAMI* is the same in both), so it's a prompt to look, not an
error.

---

## What you can't do yet

These need a developer for now:

- Upload an **SVG** logo — those still need a developer, for a security reason. JPG, PNG and WebP are fine
- Change the **contact form's fields** — they are wired to the message-handling service
- Add a **language** beyond English and Arabic
- **Undo** a published change, or see who changed what
- Separate **logins per person** — there is one shared password today

---

## If something looks wrong

Nothing you do in here can damage the live website until you press Publish. If a change
looks wrong after publishing, put the old value back and publish again. Deleting is the
exception — deleting a page, a news post or a section cannot be undone, which is why every
delete asks twice.

---

## One thing to know about uploads

Uploading works on the office machine the CMS runs on. It will not work from the CMS once the site is hosted online until the storage bucket is set up — that is a one-off setup step, not something an editor does. Until then, if you upload from a hosted CMS the upload will fail; everything else works normally.

The published website is rebuilt from scratch each time, so it always matches exactly what these screens show.
