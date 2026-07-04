# **Ink.**

## **1\. Product Overview**

Build a private, mobile-first PWA that feels like a **native app first, website second** — something that behaves like an installed app, not a browser page. 

The experience should feel like a **you-only version of Twitter/X mixed with a handwritten notebook**, but with **sleek, fluid, app-like interactions**, especially when writing.

Name: Ink.

The user can post anything they want to remember or express throughout the day — quick thoughts, memories, ideas, cooking recipes, random observations, or moments that affected them.

This is not meant for serious or sensitive storage like passwords or legal documents. It is meant to capture **you as a person** — your thoughts, experiences, and small pieces of life.

The app should feel like a personal feed where the user can:

* Quickly write something in seconds  
* Scroll through their own timeline  
* Save moments, ideas, and reflections  
* Add photos and small personal galleries to posts

Visually and emotionally, it should resemble a **black-and-white ink notebook**, but with **modern, smooth, app-like polish** — not like a webpage with inputs and boxes.

### **Important UX Direction (PWA Behavior)**

Even though this is a PWA:

* It must **not feel like a website**  
* Avoid visible browser UI patterns (scrollbars, form inputs, default focus styles)  
* Writing should feel like **typing directly into the app**, not into a web form  
* Inputs should feel **embedded into the surface**, not like HTML fields  
* Transitions should feel **native and fluid**, not page-based

---

### **Post Presentation Behavior**

* **Text-only posts** should feel like Twitter:  
  * Clean, compact, text-focused  
  * Minimal spacing  
  * Fast to read and scroll  
* **Posts with images** should feel like Instagram:  
  * Large, dominant image(s)  
  * Image is the main focus  
  * The written text becomes the **caption**  
  * Caption appears below the image(s)

This distinction must be visually clear and feel intentional.

---

The long-term goal is to include an AI layer that occasionally interacts with posts in a subtle and unpredictable way. The AI should not respond instantly or to every post. Instead, it should appear later and only on certain posts, without the user knowing which ones will receive interaction.

Additionally, the app will include a separate section inspired by “self-help black notebook” content, where users can answer guiding questions about themselves in a structured, immersive way.

At the start, the app should include a short onboarding questionnaire to understand the user’s personality, beliefs, and mindset.

Working product concept:

A private, personal feed where you can write your life in ink — with the smoothness and feel of a native app, not a website — and discover reflections later that feel like hidden notes written back to you.

---

## **2\. Core Product Principles**

### **The app should feel:**

* Private  
* Personal  
* Calm  
* Fast  
* Minimal  
* Honest  
* Non-judgmental  
* Mobile-native  
* Effortless to use many times per day  
* Like writing in a notebook, not filling out a form  
* Like an app, not a webpage  
* Ink  
* Like drawn with a pen

### **The app should not feel:**

* Like a productivity tool  
* Like a habit tracker  
* Like a public social media platform  
* Like therapy software  
* Like a formal journal that pressures long writing  
* Like an AI chatbot  
* Like a corporate UI  
* Like a web form or input-heavy interface

Posting should take less than five seconds.

---

## **3\. MVP Scope**

Build only the following features for Version 1\.

### **Authentication**

* Email/password login using Supabase Auth.  
* Single-user/private experience.  
* All data must be scoped to the authenticated user.

---

### **Onboarding Questionnaire**

When the user first signs in, show a simple questionnaire to understand them.

Include:

* What is your religion or belief system? (optional)  
* Do you believe in things like:  
  * Horoscope  
  * Crystals/energy  
  * Science-based thinking  
  * Other (free text)  
* Personality type (free text or optional preset)  
* One sentence:  
  * How do you handle bad situations?  
  * How do you handle good situations?  
* One thing you want to improve about yourself

### **UX Requirement**

* Inputs should feel like **writing on lines**, not filling forms  
* Avoid boxed inputs — use **inline text areas styled like paper**  
* Smooth transitions between questions (no page reload feel)

Store this data for future AI use.

---

### **Feed**

* Reverse chronological feed of personal posts.  
* Newest posts appear first.

Each post displays:

* Text content  
* Date and time  
* Optional post type  
* Optional tags  
* Optional images (single or small gallery)

---

### **Visual Behavior of Posts**

* **Text-only posts:**  
  * Compact layout  
  * Text-first design  
  * Similar to a private Twitter feed  
  * Fast scrolling and reading  
* **Posts with images:**  
  * Large image(s) displayed prominently  
  * Image takes up most of the visual space  
  * Text appears as a **caption below the image**, like Instagram  
  * Caption should feel secondary to the image

---

### **General Feed Styling**

* Smooth, momentum-based scrolling (native feel)  
* No visible desktop-style scrollbars  
* No “web page” bounce or awkward overscroll

Visually:

* Posts should feel like entries written on lined paper  
* Subtle horizontal lines behind content  
* Ink-like text rendering  
* Slight spacing between entries like notebook sections

---

### **Create Post**

* Easily accessible composer (floating or bottom sheet)  
* Placeholder text:  
  `What’s on your mind?`  
* Support:  
  * Short thoughts  
  * Long thoughts  
  * Memories  
  * Ideas  
  * Recipes  
  * Observations  
  * Life moments  
* Allow image uploads:  
  * Single image or small gallery per post  
* Posting should feel instant  
* Support editing and deleting posts

---

### **Composer UX (Critical)**

The composer must feel like:

* Writing directly into the app surface  
* Not typing into a web input field

Requirements:

* No visible input borders  
* No default browser styling  
* Smooth expansion as user types  
* Cursor and text feel natural and fluid  
* Keyboard interactions feel stable (no layout jumps)  
* Should resemble:  
  * Notes app  
  * iMessage input  
  * Native journaling apps

---

### **Post Types**

Optional, not required.

Initial types:

* Thought  
* Memory  
* Idea  
* Recipe  
* Moment  
* Quote  
* Dream  
* Update

Default type: `Thought`

---

### **Tags**

* Optional tagging system

Example tags:

* Work  
* School  
* Friends  
* Family  
* Personal  
* Idea  
* Health  
* Project  
* Users can create custom tags  
* Tagging should never block posting

---

### **Search**

* Search across all post text  
* Filter by:  
  * Post type  
  * Tag  
  * Date range

Search should be accessed via an icon at the top of the Feed screen, not as a separate bottom tab.

---

### **Saved / Pinned Posts**

* Allow posts to be pinned or favorited  
* Saved posts should be accessible inside the Profile section (not as a separate tab)

---

### **Self-Help / Reflection Tab**

This tab is a **guided, immersive question experience**, not a feed.

#### **Core Behavior**

* Questions are presented **one at a time**  
* The user progresses through them sequentially  
* It feels like a **continuous flow**, not page navigation  
* The experience should feel slightly **game-like**, with momentum

---

#### **Interaction Flow**

* The screen starts at the **top with a single question**  
* Below the question are **writing lines**  
* The user writes directly into the page  
* Once answered, they move to the next question  
* Transitions must feel **fluid and app-like**, not page reloads

---

#### **Visual System**

* Strict **black-and-white aesthetic**  
* Every question screen has a **full background**  
* When a question is answered:  
  * The **colors invert (black ↔ white)**  
  * The answered content becomes part of the **background context**  
  * It should feel like the page has been absorbed into the experience  
* Each new question builds on the previous ones visually  
* Subtle visual layering:  
  * Previous answers faintly visible like ghosted ink  
  * Slight blur, grain, or texture shifts  
  * The page evolves continuously

---

#### **Progression**

* A **progress indicator** is shown at the bottom:  
  * Percentage-based (e.g., 20%, 40%)  
  * Should feel like progression, not a loading bar

---

#### **Text Experience**

* Questions appear with a **self-drawing ink effect**  
* Smooth, calm, slightly mesmerizing  
* Answers feel handwritten on lines

---

#### **Aesthetic Reflection Layer (Future)**

Reflections should feel like:

* Ink appearing later  
* Marginal notes  
* Subtle highlights  
* Integrated into the page, not UI overlays

---

#### **Content (MVP)**

* Use predetermined reflection questions

---

#### **Data Behavior**

* Answers are saved privately

---

## **4\. Future AI Direction — Do Not Build Yet**

AI should feel subtle, unpredictable, and integrated.

* No instant responses  
* No chatbot UI  
* Appears later on select posts

Reflections should feel like:

* Ink appearing over time  
* Notes in margins  
* Subtle reinterpretations

---

## **5\. Data Model**

Use Supabase Postgres.

### **`profiles`**

id uuid primary key references auth.users(id)  
display\_name text  
profile\_picture\_url text  
profile\_color text  
beliefs jsonb  
personality text  
handling\_good text  
handling\_bad text  
improvement\_goal text  
created\_at timestamptz default now()  
updated\_at timestamptz default now()

---

### **`posts`**

id uuid primary key default gen\_random\_uuid()  
user\_id uuid references auth.users(id) not null  
content text not null  
post\_type text default 'thought'  
is\_pinned boolean default false  
is\_favorited boolean default false  
created\_at timestamptz default now()  
updated\_at timestamptz default now()

ai\_processed boolean default false  
ai\_summary text  
ai\_sentiment text  
ai\_topics jsonb  
ai\_embedding\_status text default 'not\_processed'

---

### **`post_images`**

id uuid primary key default gen\_random\_uuid()  
post\_id uuid references posts(id) on delete cascade  
image\_url text not null  
created\_at timestamptz default now()

---

### **`tags`**

id uuid primary key default gen\_random\_uuid()  
user\_id uuid references auth.users(id) not null  
name text not null  
created\_at timestamptz default now()

---

### **`post_tags`**

post\_id uuid references posts(id) on delete cascade  
tag\_id uuid references tags(id) on delete cascade  
primary key (post\_id, tag\_id)

---

### **`profile_changes`**

id uuid primary key default gen\_random\_uuid()  
user\_id uuid references auth.users(id)  
field\_changed text  
old\_value text  
new\_value text  
reason text  
is\_mistake boolean default false  
created\_at timestamptz default now()

---

### **Future AI Tables**

insights  
weekly\_reflections  
monthly\_reflections

---

## **6\. Security Requirements**

* Use Supabase Row Level Security on all tables  
* Users can only access their own data  
* Never trust frontend `user_id`

---

## **7\. App Structure**

Use:

Next.js  
TypeScript  
Tailwind CSS  
Supabase Auth  
Supabase Postgres  
PWA manifest

---

## **8\. Screens**

### **Login Screen**

* Minimal  
* Black and white  
* Ink-like typography  
* Inputs styled like embedded text, not form boxes

---

### **Onboarding Screen**

* Questionnaire form  
* Inputs feel like writing on lines  
* Smooth transitions between questions  
* No “form page” feeling

---

### **Feed Screen**

* Main timeline  
* Floating composer  
* Top bar:  
  * App name  
  * Search icon  
* Bottom navigation (app-style)  
* Posts behave differently depending on content:  
  * **Text-only posts:** compact, Twitter-like  
  * **Image posts:** large image(s) with caption below  
* Visual style:  
  * Ink \+ paper aesthetic  
  * Smooth, app-like motion  
  * No web UI artifacts

---

### **Composer**

* Large text area  
* Image upload  
* Optional type \+ tags

Must feel like:

* Native note input  
* No visible input boxes  
* Smooth expansion and typing

---

### **Search**

* Opened from icon in Feed  
* Overlay or slide-in panel (not page navigation)  
* Results in feed format

---

### **Reflect Tab**

* Full-screen immersive experience  
* Smooth transitions  
* No page reload feel  
* Writing feels embedded into the screen

---

### **Profile (Settings \+ Saved Combined)**

Includes:

* Profile picture  
* Username  
* Profile color  
* Editable onboarding answers  
* Change tracking

Sections:

* Saved posts  
* Settings

---

## **9\. Navigation**

Bottom navigation should feel like a native app:

Feed  
Reflect  
Profile

* Smooth transitions between tabs  
* No page reload feel  
* Search accessed via icon in Feed

---

## **10\. Visual Direction**

### **Style**

* Black-and-white first  
* Ink / notebook inspired  
* Minimal  
* Clean, modern, sleek  
* No “web UI” look

### **Key Requirement**

Everything must feel:

* Embedded  
* Fluid  
* Native  
* Touch-first

---

### **Typography**

* Clean sans-serif for readability  
* Subtle cursive accents for personality

---

### **Colors**

Background: \#000000 or \#090909  
Surface: \#111111 or paper white (\#F5F5F5)  
Border: \#2A2A2A  
Text: \#FFFFFF or \#000000  
Muted: \#8B8B8B  
Accent: customizable

---

### **Theme System**

* Profile color influences accent  
* Easily changeable themes  
* Centralized variables

---

## **11\. PWA Requirements**

* Installable on mobile  
* Must feel like a native app  
* No visible browser UI artifacts  
* Smooth scrolling and transitions  
* Stable keyboard behavior

padding-top: env(safe-area-inset-top);  
padding-bottom: env(safe-area-inset-bottom);

---

## **12\. Version 1 Acceptance Criteria**

User can:

1. Log in  
2. Complete onboarding  
3. Set profile  
4. Post text and images  
5. Scroll feed smoothly  
6. Edit/delete posts  
7. Tag posts  
8. Search via icon  
9. Use reflection flow  
10. Edit profile answers  
11. Access saved posts  
12. Use app like a native mobile app (no web feel)

---

## **13\. Explicit Non-Goals for Version 1**

Do not build:

* AI responses  
* AI UI  
* Social features  
* Sharing  
* Notifications  
* Voice notes  
* Complex analytics  
* Multi-user features

---

## **14\. Build Order**

1. Project setup  
2. Auth  
3. Database \+ RLS  
4. Onboarding  
5. Profile system  
6. Feed \+ posts  
7. Image uploads  
8. Tags \+ types  
9. Search  
10. Reflect tab  
11. Profile editing  
12. PWA setup  
13. Mobile polish

Build this as an iPhone-first PWA with reliable Safari behavior.

Core layout rules:

* Treat the app as a fixed full-screen app, not a normal scrollable website.  
* Set `html`, `body`, and the root app element to `width: 100%`, `height: 100%`, `overflow: hidden`, and prevent horizontal overflow.  
* Use a fixed app shell with `min-height: 100dvh`, not `100vh`.  
* Respect iPhone safe areas with:  
  * `padding-top: env(safe-area-inset-top)`  
  * `padding-bottom: env(safe-area-inset-bottom)`  
  * `viewport-fit=cover` in the viewport metadata.  
* Never allow white bounce space above or below the app.  
* Use `overscroll-behavior: none` on the app shell.

Scrolling behavior:

* The main app screen should not scroll by default.  
* Only allow scrolling inside intentional areas such as long lists, modal sheets, message histories, photo grids, or settings pages.  
* Every scrollable region must have a constrained height and use:  
  * `overflow-y: auto`  
  * `overscroll-behavior: contain`  
  * `-webkit-overflow-scrolling: touch`  
* Avoid nested scroll containers unless absolutely necessary.  
* Do not use a global `touchmove` preventDefault handler. Use CSS layout and targeted scroll containers instead.  
* Scrollbar rules:  
  * Do not show visible scrollbars anywhere in the app, including internal lists, modals, settings pages, and photo grids.  
  * Content may still scroll where explicitly intended, but the scrollbar track and thumb must remain visually hidden.  
  * Do not use `overflow: hidden` on areas that need to be scrollable; hide the scrollbar while preserving touch scrolling.  
  * Apply cross-browser hidden-scrollbar styles to every intentional scroll container:  
    * `scrollbar-width: none;`  
    * `-ms-overflow-style: none;`  
    * `::-webkit-scrollbar { display: none; width: 0; height: 0; }`  
  * Never use permanent desktop-style scrollbars as part of the UI.  
  * Ensure users can tell that content is scrollable through layout cues, partial content visibility, fade gradients, or a subtle swipe hint—not a visible scrollbar.

Keyboard behavior:

* Mobile keyboard opening must not make focused inputs unreachable.  
* Use the Visual Viewport API to detect keyboard resize/offset changes.  
* When the keyboard opens, temporarily resize or shift the active input sheet/modal so the focused input stays visible.  
* Allow scrolling only inside the active form/modal while the keyboard is open.  
* Return to the locked no-page-scroll state once the keyboard closes.  
* Use `scrollIntoView({ block: "nearest" })` for focused inputs when appropriate.  
* Set all text inputs and textareas to at least `font-size: 16px` on iPhone to prevent Safari auto-zoom.

Modals and bottom sheets:

* Render modals in a top-level portal above the app shell.  
* Lock background interaction when a modal is open.  
* Keep the modal itself within the visible viewport and safe areas.  
* For long modal content, make only the modal body scrollable, not the entire page.  
* Bottom sheets should use `max-height: calc(100dvh - safe-area offsets)`.

Viewport and responsiveness:

* Design around narrow iPhones first: 320px–430px wide.  
* Test at short viewport heights such as iPhone SE-sized screens, not only tall Pro Max screens.  
* Avoid hard-coded vertical pixel positioning for key content.  
* Use flex and grid with `min-height: 0` where children need to scroll.  
* Ensure buttons remain reachable above the home indicator and browser/PWA UI.  
* Use responsive spacing with `clamp()` rather than many fixed values.

PWA behavior:

* Add a manifest, icons, theme color, and Apple web app meta tags.  
* Support standalone display mode gracefully.  
* Make status-bar/background colors match the app so iOS does not show white edges.  
* Preserve state when the app backgrounds, reloads, or resumes.

Acceptance checks:

1. No normal page scroll or white bounce space on iPhone.  
2. Inputs remain usable with the keyboard open.  
3. Long content scrolls only where intended.  
4. Modals do not exceed the visible screen.  
5. Nothing is hidden behind the notch, status bar, Dynamic Island, or home indicator.  
6. No accidental Safari zoom when typing.  
7. Test in Safari and installed PWA mode on real iPhone-sized viewports.

