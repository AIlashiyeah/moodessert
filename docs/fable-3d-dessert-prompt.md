# Prompt for Fable 5.2: Moodessert 3D particle desserts

Copy everything below the line into Fable.

---

Build the result-reveal animation for **Moodessert**, a mobile-first web quiz that turns a person's answers into a dessert. Deliver working code, not a plan.

## What the animation does (about 4.5 s total)
1. **Words fall in (0–1.5 s).** 3–8 short keywords from the user's answers (Chinese or English, passed in) drop from the top as small text labels into a shallow bowl outline at lower centre, with slight gravity and bounce.
2. **Burst (1.5–2.2 s).** When the last word lands, the words dissolve into particles that burst outward from the bowl.
3. **Bake (2.2–4.0 s).** The particles fly into a **3D point-cloud model of the dessert** and settle. The dessert must be recognisable by its shape and colours alone, without any label. Do not form the dessert's name as text.
4. **Hold (4.0 s on).** The finished dessert rotates slowly (one turn every ~12 s), with a gentle breathing shimmer on the particles. Call `onDone()` at 4.0 s so the page can show the result card.

## Interface
Ship one ES module `bake.js` that exports:

```js
bakeDessert(container, {
  dessert: "tiramisu",          // one of the 16 ids below
  palette: ["#3B2416", "#F5E6D3", "#8B5A3C"], // branch colours, override the defaults
  words: ["凌晨两点", "薄荷道歉", "晚霞"],
  reducedMotion: false,         // true: skip to the finished, still dessert
  onDone: () => {}
}) // returns { destroy() } that stops the loop and frees GPU memory
```

Also ship `demo.html`: a dropdown that cycles all 16 desserts and a "replay" button, so each shape can be reviewed on a phone.

## Technical constraints
- Three.js only, loaded from a pinned CDN build (cdnjs or jsDelivr, exact version, no `latest`). No other libraries, no image or model files: every shape is built in code from primitives (cylinders, boxes, tori, spheres, lathe and extrude geometry) and sampled into points with `MeshSurfaceSampler` (plus some volume fill so layers read as solid).
- Mobile budget: at most 6,000 particles, device pixel ratio capped at 2, steady 60 fps on a mid-range phone. One draw call for the particles (a single `THREE.Points` with per-point colour and size).
- Transparent canvas background so it sits on the page's own card colour in light and dark mode. Particle colours come from the palette, never pure white on light backgrounds.
- Canvas is square, fills its container width (360–460 px on phones). Camera slightly above, about 25° down, so layers and toppings are visible.
- Text labels for the falling words: render to a canvas texture, use a system CJK-capable font stack, no web-font dependency.
- Respect `prefers-reduced-motion` and the `reducedMotion` flag.
- Clean up everything in `destroy()`.

## The 16 desserts (id: shape, signature details, default colours)
Each needs one detail that makes it unmistakable. Exaggerate it slightly.

1. `mille-feuille`: rectangular slice, 3 thin flaky pastry layers with 2 thick cream layers between, top glazed with feathered chocolate lines. Pastry gold, cream ivory, lines dark brown.
2. `opera`: low flat rectangle, 6+ very thin even layers alternating coffee sponge and dark ganache, glossy top with one gold-leaf fleck. Dark brown, coffee, gold.
3. `dark-chocolate-tart`: round shallow tart with fluted pastry rim, flat glossy ganache surface. Pastry tan, ganache near-black.
4. `strawberry-shortcake`: tall round-cake wedge, two sponge layers with cream between, whole strawberries on top and halved strawberries visible in the cut face. White, sponge yellow, strawberry red.
5. `tiramisu`: square cut piece, alternating ladyfinger (soaked brown) and mascarpone (cream) layers, fine cocoa dust on top. Cocoa brown, cream, coffee.
6. `coffee-jelly`: clear short glass holding dark translucent cubes with a swirl of cream on top. Dark coffee, white, glass as faint sparse points.
7. `basque-cheesecake`: tall wedge with a deeply burnt, almost black, cracked and domed top that collapses toward the centre; pale creamy interior on the cut face; rough paper edge. Burnt black-brown top, custard interior.
8. `souffle`: white ramekin with a dramatic risen dome rising well above the rim, dusted with icing sugar. Ramekin white, dome golden.
9. `creme-caramel`: inverted dome on a small plate, glossy caramel flowing down and pooling around the base. Custard yellow, caramel amber.
10. `donut`: torus with glaze on the upper half and scattered rod-shaped sprinkles. Dough tan, glaze pink, multicolour sprinkles.
11. `mango-bingsu`: bowl with a tall fluffy snow mound, mango cubes stacked on top, a drizzle of condensed milk. Snow white, mango orange.
12. `brownie`: square block with a crackly shiny top and slightly fudgy sides. Dark chocolate.
13. `macaron`: two domed shells with ruffled "feet" at the edge and a filling layer between. Pastel lilac shells, cream filling.
14. `new-york-cheesecake`: tall dense wedge on a thick graham-crumb base, smooth flat top. Cream, golden edge, crumb brown.
15. `cream-puff`: round choux ball with a crackled cookie top, split open with cream bulging out. Golden brown, cream.
16. `egg-tart`: small round fluted pastry cup filled with glossy custard with 3–5 caramelised dark spots on top. Pastry gold, custard yellow, spots brown.

Branch flavours only change the palette (for example, strawberry tiramisu swaps the mascarpone colour to pink); the shape stays the same.

## Quality bar
- A stranger shown each finished dessert for two seconds, with no text, should name it correctly. If a shape is ambiguous (brownie vs. opera, NY cheesecake vs. Basque), push its signature detail harder until it isn't.
- The burst and regroup should feel like baking: particles accelerate out, then ease in with slight overshoot; no linear motion.
- No visible popping, no particles stranded outside the model at rest.

## Deliverables
`bake.js`, `demo.html`, and a short note listing the Three.js version used and anything you could not achieve.
