# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: restaurant-registration.spec.ts >> a failed reverse lookup preserves the pin and manual address and shows an inline explanation
- Location: tests\browser\restaurant-registration.spec.ts:265:5

# Error details

```
Error: expect(locator).toHaveValue(expected) failed

Locator: getByLabel('Địa chỉ')
Expected: "Địa chỉ tự nhập"
Error: strict mode violation: getByLabel('Địa chỉ') resolved to 2 elements:
    1) <input id="_r_5_" required="" class="input" maxlength="255" name="addressLine" aria-invalid="false" value="Địa chỉ tự nhập" autocomplete="street-address"/> aka getByRole('textbox', { name: 'Địa chỉ *' })
    2) <input value="" class="input" type="search" maxlength="256" autocomplete="off" aria-label="Tìm địa chỉ hoặc địa điểm" placeholder="Tìm địa chỉ hoặc địa điểm"/> aka getByRole('searchbox', { name: 'Tìm địa chỉ hoặc địa điểm' })

Call log:
  - Expect "toHaveValue" getByLabel('Địa chỉ') with timeout 10000ms
  - waiting for getByLabel('Địa chỉ')

```

# Test source

```ts
  178 |   await page.getByLabel("Số điện thoại nhà hàng").fill("02438262648");
  179 |   await page.getByLabel("Địa chỉ", { exact: false }).fill("24 Nguyễn Hữu Huân");
  180 |   await page.getByLabel("Tỉnh / thành phố").fill("Thành phố Hà Nội");
  181 |   await expect(page.getByLabel("Quận / huyện")).toHaveCount(0);
  182 |   const ward = page.getByRole("combobox", { name: "Phường / xã" });
  183 |   await ward.fill(useWardSuggestions ? "ba dinh" : "Phường Ba Đình");
  184 |   if (useWardSuggestions)
  185 |     await page
  186 |       .getByRole("option", { name: "Phường Ba Đình", exact: true })
  187 |       .click();
  188 | }
  189 | async function pickLocation(page: Page) {
  190 |   await page.getByRole("button", { name: "Chọn vị trí trên bản đồ" }).click();
  191 |   const dialog = page.getByRole("dialog", { name: "Chọn vị trí nhà hàng" });
  192 |   await expect(
  193 |     dialog.getByRole("button", { name: "Lưu vị trí" }),
  194 |   ).toBeDisabled();
  195 |   await dialog
  196 |     .getByRole("button", { name: "Nhập tọa độ", exact: true })
  197 |     .click();
  198 |   await dialog.getByLabel("Vĩ độ").fill("21.0285");
  199 |   await dialog.getByLabel("Kinh độ").fill("105.8542");
  200 |   await dialog.getByRole("button", { name: "Lưu vị trí", exact: true }).click();
  201 | }
  202 | 
  203 | test("saving a pin prefills the street and current province/ward, replacing the previous address only in the draft", async ({
  204 |   page,
  205 | }) => {
  206 |   let reverseRequests = 0;
  207 |   await page.route(
  208 |     "https://api.mapbox.com/search/geocode/v6/reverse**",
  209 |     (route) => {
  210 |       reverseRequests++;
  211 |       const url = new URL(route.request().url());
  212 |       expect(url.searchParams.get("latitude")).toBe("21.04");
  213 |       expect(url.searchParams.get("longitude")).toBe("105.83");
  214 |       return route.fulfill({
  215 |         json: {
  216 |           features: [
  217 |             {
  218 |               type: "Feature",
  219 |               geometry: { type: "Point", coordinates: [105.8301, 21.0401] },
  220 |               properties: {
  221 |                 feature_type: "address",
  222 |                 name: "18 Hoàng Hoa Thám",
  223 |                 context: {
  224 |                   address: { name: "18 Hoàng Hoa Thám" },
  225 |                   region: { name: "Hà Nội" },
  226 |                   locality: { name: "Ngọc Hà" },
  227 |                   country: { country_code: "VN" },
  228 |                 },
  229 |               },
  230 |             },
  231 |           ],
  232 |         },
  233 |       });
  234 |     },
  235 |   );
  236 |   await login(page);
  237 |   await page.getByLabel("Địa chỉ", { exact: false }).fill("Địa chỉ cũ");
  238 |   await page.getByLabel("Tỉnh / thành phố").fill("Thành phố Hà Nội");
  239 |   await page
  240 |     .getByRole("combobox", { name: "Phường / xã" })
  241 |     .fill("Phường Ba Đình");
  242 |   await page.getByRole("button", { name: "Chọn vị trí trên bản đồ" }).click();
  243 |   const dialog = page.getByRole("dialog", { name: "Chọn vị trí nhà hàng" });
  244 |   await dialog
  245 |     .getByRole("button", { name: "Nhập tọa độ", exact: true })
  246 |     .click();
  247 |   await dialog.getByLabel("Vĩ độ").fill("21.04");
  248 |   await dialog.getByLabel("Kinh độ").fill("105.83");
  249 |   await dialog.getByRole("button", { name: "Lưu vị trí", exact: true }).click();
  250 |   await expect(dialog).not.toBeVisible();
  251 |   await expect(page.getByLabel("Địa chỉ", { exact: false })).toHaveValue(
  252 |     "18 Hoàng Hoa Thám",
  253 |   );
  254 |   await expect(page.getByLabel("Tỉnh / thành phố")).toHaveValue(
  255 |     "Thành phố Hà Nội",
  256 |   );
  257 |   await expect(page.getByRole("combobox", { name: "Phường / xã" })).toHaveValue(
  258 |     "Phường Ngọc Hà",
  259 |   );
  260 |   await expect(page.getByText("Đã chọn: 21.040000, 105.830000")).toBeVisible();
  261 |   expect(reverseRequests).toBe(1);
  262 |   expect(requests).toHaveLength(0);
  263 | });
  264 | 
  265 | test("a failed reverse lookup preserves the pin and manual address and shows an inline explanation", async ({
  266 |   page,
  267 | }) => {
  268 |   await page.route(
  269 |     "https://api.mapbox.com/search/geocode/v6/reverse**",
  270 |     (route) => route.fulfill({ status: 503 }),
  271 |   );
  272 |   await login(page);
  273 |   await page.getByLabel("Địa chỉ", { exact: false }).fill("Địa chỉ tự nhập");
  274 |   await page.getByLabel("Tỉnh / thành phố").fill("Thành phố Hà Nội");
  275 |   // Close the province suggestions, which overlay the location button.
  276 |   await page.keyboard.press("Escape");
  277 |   await pickLocation(page);
> 278 |   await expect(page.getByLabel("Địa chỉ", { exact: false })).toHaveValue(
      |                                                              ^ Error: expect(locator).toHaveValue(expected) failed
  279 |     "Địa chỉ tự nhập",
  280 |   );
  281 |   await expect(page.getByLabel("Tỉnh / thành phố")).toHaveValue(
  282 |     "Thành phố Hà Nội",
  283 |   );
  284 |   await expect(page.getByText(/Chưa tự lấy được địa chỉ/)).toBeVisible();
  285 |   expect(requests).toHaveLength(0);
  286 | });
  287 | 
  288 | test("required fields and explicit location prevent accidental registration", async ({
  289 |   page,
  290 | }) => {
  291 |   const pageErrors: string[] = [];
  292 |   page.on("pageerror", (error) => pageErrors.push(error.message));
  293 |   await page.setViewportSize({ width: 1440, height: 1000 });
  294 |   await login(page);
  295 |   await page
  296 |     .getByRole("button", { name: "Đăng ký nhà hàng", exact: true })
  297 |     .click();
  298 |   await expect(page.getByText("Tên nhà hàng là bắt buộc.")).toBeVisible();
  299 |   await expect(
  300 |     page.getByText("Chọn vị trí nhà hàng hoặc nhập tọa độ hợp lệ."),
  301 |   ).toBeVisible();
  302 |   await expect(page.getByLabel("Tên nhà hàng")).toBeFocused();
  303 |   expect(requests).toHaveLength(0);
  304 |   await fill(page);
  305 |   await pickLocation(page);
  306 |   await expect(page.getByText("Đã chọn: 21.028500, 105.854200")).toBeVisible();
  307 |   const opener = page.getByRole("button", { name: "Chọn vị trí trên bản đồ" });
  308 |   await opener.click();
  309 |   await page
  310 |     .getByRole("dialog")
  311 |     .getByRole("button", { name: "Nhập tọa độ", exact: true })
  312 |     .click();
  313 |   await page.getByRole("dialog").getByLabel("Vĩ độ").fill("22");
  314 |   await page.keyboard.press("Escape");
  315 |   await expect(page.getByRole("dialog")).toHaveCount(0);
  316 |   await expect(opener).toBeFocused();
  317 |   await expect(page.getByText("Đã chọn: 21.028500, 105.854200")).toBeVisible();
  318 |   await page.evaluate(() => window.scrollTo(0, 0));
  319 |   await page.screenshot({
  320 |     path: "artifacts/owner-register-desktop.png",
  321 |     fullPage: true,
  322 |   });
  323 |   expect(
  324 |     await page.evaluate(
  325 |       () => document.documentElement.scrollWidth <= innerWidth,
  326 |     ),
  327 |   ).toBe(true);
  328 |   expect(pageErrors).toEqual([]);
  329 | });
  330 | 
  331 | test("multipart media and a numeric OWN-01 request preserve 201 and produce unverified onboarding", async ({
  332 |   page,
  333 | }) => {
  334 |   await login(page);
  335 |   await fill(page);
  336 |   const province = page.getByRole("combobox", { name: "Tỉnh / thành phố" });
  337 |   await province.fill("ha noi");
  338 |   await page
  339 |     .getByRole("option", { name: "Thành phố Hà Nội", exact: true })
  340 |     .click();
  341 |   await pickLocation(page);
  342 |   const mediaResponse = page.waitForResponse(
  343 |     (res) =>
  344 |       res.url().endsWith("/api/backend/media") &&
  345 |       res.request().method() === "POST",
  346 |   );
  347 |   await page
  348 |     .getByLabel("Ảnh bìa", { exact: true })
  349 |     .setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: png });
  350 |   expect((await mediaResponse).status()).toBe(201);
  351 |   await expect(page.getByRole("button", { name: /Bỏ ảnh bìa/ })).toBeEnabled();
  352 |   const registered = page.waitForResponse(
  353 |     (res) =>
  354 |       res.url().endsWith("/api/backend/owner/restaurant") &&
  355 |       res.request().method() === "POST",
  356 |   );
  357 |   await page
  358 |     .getByRole("button", { name: "Đăng ký nhà hàng", exact: true })
  359 |     .click();
  360 |   expect((await registered).status()).toBe(201);
  361 |   await expect(
  362 |     page.getByRole("heading", { name: "Đăng ký nhà hàng thành công" }),
  363 |   ).toBeVisible();
  364 |   await expect(page.getByText("Chưa xác minh", { exact: true })).toBeVisible();
  365 |   expect(requests).toHaveLength(1);
  366 |   expect(requests[0]).toMatchObject({
  367 |     name: "Bếp Nhà",
  368 |     provinceName: "Thành phố Hà Nội",
  369 |     ward: "Phường Ba Đình",
  370 |     latitude: 21.0285,
  371 |     longitude: 105.8542,
  372 |     coverMediaId: 9001,
  373 |   });
  374 |   expect(requests[0]).not.toHaveProperty("priceLevel");
  375 |   expect(requests[0]).not.toHaveProperty("district");
  376 |   expect(uploads[0].type).toMatch(/^multipart\/form-data; boundary=/);
  377 |   expect(uploads[0].body).toContain('name="purpose"');
  378 |   expect(uploads[0].body).toContain("restaurant");
```