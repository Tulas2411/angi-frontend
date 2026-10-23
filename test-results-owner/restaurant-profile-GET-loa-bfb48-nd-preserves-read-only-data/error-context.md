# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: restaurant-profile.spec.ts >> GET loads the owner profile; PATCH sends only edited values and preserves read-only data
- Location: tests\browser\restaurant-profile.spec.ts:166:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://localhost:3001/login", waiting until "load"

```

# Test source

```ts
  44  |     };
  45  |     if (request.url === "/api/v1/auth/login") {
  46  |       const { email } = JSON.parse(raw) as { email: string };
  47  |       send(200, {
  48  |         accessToken: "profile-test-access",
  49  |         refreshToken: "profile-test-refresh",
  50  |         accessTokenExpiresAt: new Date(Date.now() + 900000).toISOString(),
  51  |         refreshTokenExpiresAt: new Date(Date.now() + 2592000000).toISOString(),
  52  |         user: {
  53  |           id: 12,
  54  |           email,
  55  |           displayName: "Chủ nhà hàng",
  56  |           avatarUrl: null,
  57  |           role: email.startsWith("traveler") ? "TRAVELER" : "RESTAURANT_OWNER",
  58  |           status: "active",
  59  |           needsPreferenceSurvey: null,
  60  |         },
  61  |       });
  62  |     } else if (
  63  |       request.url === "/api/v1/owner/restaurant" &&
  64  |       request.method === "GET"
  65  |     ) {
  66  |       if (failGet) {
  67  |         send(503, null, "SERVICE_UNAVAILABLE");
  68  |       } else
  69  |         send(
  70  |           current ? 200 : 404,
  71  |           current,
  72  |           current ? null : "RESTAURANT_NOT_FOUND",
  73  |         );
  74  |     } else if (
  75  |       request.url === "/api/v1/owner/restaurant" &&
  76  |       request.method === "PATCH"
  77  |     ) {
  78  |       const patch = JSON.parse(raw) as UpdateRestaurantRequestDto;
  79  |       patches.push(patch);
  80  |       if (delayPatch) await new Promise((resolve) => setTimeout(resolve, 600));
  81  |       if (failPatch) {
  82  |         failPatch = false;
  83  |         send(400, null, "VALIDATION_FAILED", {
  84  |           Name: ["Tên nhà hàng chưa hợp lệ."],
  85  |         });
  86  |       } else if (!current) send(404, null, "RESTAURANT_NOT_FOUND");
  87  |       else {
  88  |         const { coverMediaId, imageMediaIds, ...fields } = patch;
  89  |         current = { ...current, ...fields, updatedAt: "2026-10-14T02:00:00Z" };
  90  |         if (patch.name) current.name = patch.name.trim();
  91  |         if (coverMediaId !== undefined)
  92  |           current.coverUrl =
  93  |             coverMediaId === null
  94  |               ? null
  95  |               : "/assets/figma/roadmap-restaurant.png";
  96  |         if (imageMediaIds !== undefined)
  97  |           current.images = imageMediaIds.map(
  98  |             () => "/assets/figma/roadmap-restaurant.png",
  99  |           );
  100 |         send(200, current);
  101 |       }
  102 |     } else if (request.url === "/api/v1/media" && request.method === "POST") {
  103 |       uploads++;
  104 |       send(201, {
  105 |         id: 9000 + uploads,
  106 |         url: "/assets/figma/roadmap-restaurant.png",
  107 |         mimeType: "image/png",
  108 |         sizeBytes: png.length,
  109 |         purpose: "restaurant",
  110 |         createdAt: "2026-10-14T02:00:00Z",
  111 |       });
  112 |     } else send(404, null, "ROUTE_NOT_FOUND");
  113 |   });
  114 |   await new Promise<void>((resolve) =>
  115 |     server.listen(5164, "127.0.0.1", resolve),
  116 |   );
  117 | });
  118 | test.afterAll(async () => {
  119 |   await new Promise<void>((resolve, reject) =>
  120 |     server.close((error) => (error ? reject(error) : resolve())),
  121 |   );
  122 | });
  123 | test.beforeEach(async ({ page }) => {
  124 |   current = structuredClone(ownerRestaurantSample);
  125 |   patches = [];
  126 |   failGet = false;
  127 |   failPatch = false;
  128 |   delayPatch = false;
  129 |   uploads = 0;
  130 |   await stubMapboxRendering(page);
  131 |   await stubWardCatalogs(page);
  132 |   await page.route("**/api/locations/provinces", (route) =>
  133 |     route.fulfill({
  134 |       json: {
  135 |         success: true,
  136 |         message: null,
  137 |         errorCode: null,
  138 |         data: [{ name: "Thành phố Đà Nẵng", code: 48 }],
  139 |       },
  140 |     }),
  141 |   );
  142 | });
  143 | async function login(page: Page, traveler = false) {
> 144 |   await page.goto("/login");
      |              ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  145 |   await page
  146 |     .getByLabel(/^Email/)
  147 |     .fill(traveler ? "traveler@profile.test" : "owner@profile.test");
  148 |   await page.getByLabel(/^Mật khẩu/).fill("TestPassword123");
  149 |   await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  150 |   await expect(page).toHaveURL(traveler ? /\/$/ : /\/restaurant$/, {
  151 |     timeout: 30000,
  152 |   });
  153 |   if (!traveler)
  154 |     await expect(page.locator("main h1")).toBeVisible({ timeout: 30000 });
  155 | }
  156 | async function openProfile(page: Page) {
  157 |   await login(page);
  158 |   await page.goto("/restaurant/profile");
  159 |   await expect(page.getByLabel("Tên nhà hàng")).toHaveValue(
  160 |     ownerRestaurantSample.name,
  161 |   );
  162 | }
  163 | const save = (page: Page) =>
  164 |   page.getByRole("button", { name: "Lưu thay đổi", exact: true });
  165 | 
  166 | test("GET loads the owner profile; PATCH sends only edited values and preserves read-only data", async ({
  167 |   page,
  168 | }) => {
  169 |   await openProfile(page);
  170 |   await expect(page.getByLabel("Mức giá (không bắt buộc)")).toHaveValue("1");
  171 |   await expect(page.getByLabel("Phường / xã")).toHaveValue("Phường Hải Châu 1");
  172 |   await expect(save(page)).toBeDisabled();
  173 |   await page.getByLabel("Tên nhà hàng").fill("  Bún Bò Bà Diệu - Lê Duẩn  ");
  174 |   await page.getByLabel("Email nhà hàng").fill("");
  175 |   const updated = page.waitForResponse(
  176 |     (response) =>
  177 |       response.url().endsWith("/api/backend/owner/restaurant") &&
  178 |       response.request().method() === "PATCH",
  179 |   );
  180 |   await save(page).click();
  181 |   expect((await updated).status()).toBe(200);
  182 |   await expect(
  183 |     page.getByText("Đã lưu hồ sơ nhà hàng.", { exact: true }),
  184 |   ).toBeVisible();
  185 |   await expect(page.getByLabel("Tên nhà hàng")).toHaveValue(
  186 |     "Bún Bò Bà Diệu - Lê Duẩn",
  187 |   );
  188 |   expect(patches).toEqual([{ name: "Bún Bò Bà Diệu - Lê Duẩn", email: null }]);
  189 |   expect(current).toMatchObject({
  190 |     verificationStatus: "verified",
  191 |     moderationStatus: "visible",
  192 |     businessHours: ownerRestaurantSample.businessHours,
  193 |     openMenuSubmission: ownerRestaurantSample.openMenuSubmission,
  194 |     images: ownerRestaurantSample.images,
  195 |   });
  196 |   await page.reload();
  197 |   await expect(page.getByLabel("Tên nhà hàng")).toHaveValue(
  198 |     "Bún Bò Bà Diệu - Lê Duẩn",
  199 |   );
  200 | });
  201 | 
  202 | test("local and backend validation retain drafts, focus the invalid field and allow retry", async ({
  203 |   page,
  204 | }) => {
  205 |   await openProfile(page);
  206 |   await page.getByLabel("Tên nhà hàng").fill("");
  207 |   await page.getByLabel("Số điện thoại nhà hàng").fill("");
  208 |   await save(page).click();
  209 |   await expect(
  210 |     page.getByText("Tên nhà hàng không được để trống."),
  211 |   ).toBeVisible();
  212 |   expect(patches).toHaveLength(0);
  213 |   failPatch = true;
  214 |   await page.getByLabel("Tên nhà hàng").fill("Quán mới");
  215 |   await expect(page.getByLabel("Tên nhà hàng")).toBeFocused();
  216 |   await page
  217 |     .getByLabel("Số điện thoại nhà hàng")
  218 |     .fill(ownerRestaurantSample.phone ?? "");
  219 |   await save(page).click();
  220 |   await expect(page.getByText("Tên nhà hàng chưa hợp lệ.")).toBeVisible();
  221 |   await expect(page.getByLabel("Tên nhà hàng")).toBeFocused();
  222 |   await expect(page.getByLabel("Tên nhà hàng")).toHaveValue("Quán mới");
  223 |   await save(page).click();
  224 |   await expect(
  225 |     page.getByText("Đã lưu hồ sơ nhà hàng.", { exact: true }),
  226 |   ).toBeVisible();
  227 |   expect(patches).toHaveLength(2);
  228 | });
  229 | 
  230 | test("province choices preserve unchanged profile values and PATCH the selected official name", async ({
  231 |   page,
  232 | }) => {
  233 |   await page.route("**/api/locations/provinces", (route) =>
  234 |     route.fulfill({
  235 |       json: {
  236 |         success: true,
  237 |         data: [
  238 |           { name: "Thành phố Đà Nẵng", code: 48 },
  239 |           { name: "Tỉnh Điện Biên", code: 11 },
  240 |         ],
  241 |       },
  242 |     }),
  243 |   );
  244 |   await openProfile(page);
```