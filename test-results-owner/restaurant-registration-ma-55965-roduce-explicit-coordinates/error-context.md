# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: restaurant-registration.spec.ts >> map keyboard selection and permanent address search produce explicit coordinates
- Location: tests\browser\restaurant-registration.spec.ts:456:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('dialog').getByRole('button', { name: /Nhà hàng thử nghiệm/ })

```

# Test source

```ts
  393 |   await expect(page.getByLabel("Tên nhà hàng")).toHaveAttribute(
  394 |     "aria-invalid",
  395 |     "true",
  396 |   );
  397 |   await expect(page.getByLabel("Mức giá (không bắt buộc)")).toHaveAttribute(
  398 |     "aria-invalid",
  399 |     "true",
  400 |   );
  401 |   await expect(page.getByText("Vui lòng kiểm tra mức giá.")).toBeVisible();
  402 |   await page
  403 |     .getByRole("button", { name: "Đăng ký nhà hàng", exact: true })
  404 |     .click();
  405 |   await expect(
  406 |     page.getByRole("heading", { name: "Đăng ký nhà hàng thành công" }),
  407 |   ).toBeVisible();
  408 |   expect(requests).toHaveLength(2);
  409 | });
  410 | 
  411 | test("a registration conflict stops further submissions", async ({ page }) => {
  412 |   conflictNext = true;
  413 |   await login(page);
  414 |   await fill(page);
  415 |   await pickLocation(page);
  416 |   await page
  417 |     .getByRole("button", { name: "Đăng ký nhà hàng", exact: true })
  418 |     .click();
  419 |   await expect(
  420 |     page.getByRole("heading", { name: "Bạn đã có nhà hàng" }),
  421 |   ).toBeVisible();
  422 |   await expect(
  423 |     page.getByRole("button", { name: "Đăng ký nhà hàng", exact: true }),
  424 |   ).toHaveCount(0);
  425 |   expect(requests).toHaveLength(1);
  426 | });
  427 | 
  428 | test("existing owners and non-owner sessions cannot register another restaurant", async ({
  429 |   page,
  430 | }) => {
  431 |   restaurant = response({
  432 |     name: "Quán hiện có",
  433 |     phone: "02438262648",
  434 |     addressLine: "24 Nguyễn Hữu Huân",
  435 |     district: "Quận Hoàn Kiếm",
  436 |     provinceName: "Thành phố Hà Nội",
  437 |     latitude: 21.0285,
  438 |     longitude: 105.8542,
  439 |   });
  440 |   await login(page);
  441 |   await expect(
  442 |     page.getByRole("heading", { name: "Quán hiện có", level: 1 }),
  443 |   ).toBeVisible();
  444 |   await page.context().clearCookies();
  445 |   await login(page, "traveler@test.local");
  446 |   await page.goto("/restaurant/register");
  447 |   await expect(page).toHaveURL(/\/$/);
  448 |   const denied = await page.request.post("/api/backend/owner/restaurant", {
  449 |     headers: { origin: "http://localhost:3001" },
  450 |     data: {},
  451 |   });
  452 |   expect(denied.status()).toBe(403);
  453 |   expect(requests).toHaveLength(0);
  454 | });
  455 | 
  456 | test("map keyboard selection and permanent address search produce explicit coordinates", async ({
  457 |   page,
  458 | }) => {
  459 |   await page.route("https://api.mapbox.com/search/geocode/**", (route) => {
  460 |     const url = new URL(route.request().url());
  461 |     expect(url.searchParams.get("permanent")).toBe("true");
  462 |     return route.fulfill({
  463 |       json: {
  464 |         features: [
  465 |           {
  466 |             geometry: { coordinates: [106.7009, 10.7769] },
  467 |             properties: { full_address: "Nhà hàng thử nghiệm" },
  468 |           },
  469 |         ],
  470 |       },
  471 |     });
  472 |   });
  473 |   await login(page);
  474 |   await page.getByRole("button", { name: "Chọn vị trí trên bản đồ" }).click();
  475 |   const dialog = page.getByRole("dialog");
  476 |   const map = dialog.getByRole("application", {
  477 |     name: "Bản đồ chọn vị trí nhà hàng",
  478 |   });
  479 |   await expect(map).toHaveAttribute("aria-busy", "false");
  480 |   await map.locator("canvas").focus();
  481 |   await page.keyboard.press("ArrowRight");
  482 |   await page.keyboard.press("Enter");
  483 |   await dialog
  484 |     .getByRole("button", { name: "Nhập tọa độ", exact: true })
  485 |     .click();
  486 |   expect(
  487 |     Number(await dialog.getByLabel("Kinh độ").inputValue()),
  488 |   ).toBeGreaterThan(105.8542);
  489 |   await dialog
  490 |     .getByLabel("Tìm địa chỉ hoặc địa điểm")
  491 |     .fill("Nhà hàng thử nghiệm");
  492 |   await dialog.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
> 493 |   await dialog.getByRole("button", { name: /Nhà hàng thử nghiệm/ }).click();
      |                                                                     ^ Error: locator.click: Test timeout of 60000ms exceeded.
  494 |   await dialog.getByRole("button", { name: "Lưu vị trí" }).click();
  495 |   await expect(page.getByText("Đã chọn: 10.776900, 106.700900")).toBeVisible();
  496 | });
  497 | 
  498 | test("map information cards close independently and keep the pin and saved coordinates", async ({
  499 |   page,
  500 | }) => {
  501 |   await page.setViewportSize({ width: 1440, height: 1000 });
  502 |   await login(page);
  503 |   await page.getByRole("button", { name: "Chọn vị trí trên bản đồ" }).click();
  504 |   const dialog = page.getByRole("dialog", { name: "Chọn vị trí nhà hàng" });
  505 |   const map = dialog.getByRole("application", {
  506 |     name: "Bản đồ chọn vị trí nhà hàng",
  507 |   });
  508 |   await expect(map).toHaveAttribute("aria-busy", "false");
  509 |   const mapBounds = await map.boundingBox();
  510 |   const dialogBounds = await dialog.boundingBox();
  511 |   if (!mapBounds || !dialogBounds)
  512 |     throw new Error("Map dialog must have visible bounds.");
  513 |   expect(Math.abs(mapBounds.width - dialogBounds.width)).toBeLessThan(4);
  514 |   expect(Math.abs(mapBounds.height - dialogBounds.height)).toBeLessThan(4);
  515 |   await map.click({
  516 |     position: { x: mapBounds.width * 0.7, y: mapBounds.height * 0.55 },
  517 |   });
  518 |   const pin = dialog.getByRole("button", {
  519 |     name: "Hiển thị thông tin vị trí đã chọn",
  520 |   });
  521 |   await expect(pin).toBeVisible();
  522 |   await dialog
  523 |     .getByRole("button", { name: "Nhập tọa độ", exact: true })
  524 |     .click();
  525 |   await dialog.getByLabel("Vĩ độ").fill("21.0285");
  526 |   await dialog.getByLabel("Kinh độ").fill("105.8542");
  527 |   await dialog.getByRole("button", { name: "Đóng bảng nhập tọa độ" }).click();
  528 |   const pinInfo = dialog.getByRole("region", {
  529 |     name: "Thông tin điểm trên bản đồ",
  530 |     exact: true,
  531 |   });
  532 |   const summary = dialog.getByRole("region", {
  533 |     name: "Thông tin địa điểm đã chọn",
  534 |     exact: true,
  535 |   });
  536 |   await expect(pinInfo).toContainText("21.02850° N, 105.85420° E");
  537 |   await expect(summary).toBeVisible();
  538 |   await dialog.screenshot({
  539 |     path: "artifacts/restaurant-map-live-layout-desktop.png",
  540 |   });
  541 |   await dialog
  542 |     .getByRole("button", { name: "Ẩn thông tin điểm trên bản đồ", exact: true })
  543 |     .click();
  544 |   await expect(pinInfo).toHaveCount(0);
  545 |   await expect(summary).toBeVisible();
  546 |   await expect(pin).toBeFocused();
  547 |   await dialog
  548 |     .getByRole("button", { name: "Ẩn thông tin địa điểm đã chọn", exact: true })
  549 |     .click();
  550 |   await expect(summary).toHaveCount(0);
  551 |   await expect(pin).toBeVisible();
  552 |   await dialog.getByRole("button", { name: "Phóng to bản đồ" }).click();
  553 |   await expect(pinInfo).toHaveCount(0);
  554 |   await expect(summary).toHaveCount(0);
  555 |   await pin.click();
  556 |   await expect(pinInfo).toContainText("21.02850° N, 105.85420° E");
  557 |   await expect(summary).toBeVisible();
  558 |   await dialog
  559 |     .getByRole("button", { name: "Ẩn thông tin điểm trên bản đồ", exact: true })
  560 |     .click();
  561 |   await dialog
  562 |     .getByRole("button", { name: "Ẩn thông tin địa điểm đã chọn", exact: true })
  563 |     .click();
  564 |   await dialog.getByRole("button", { name: "Lưu vị trí", exact: true }).click();
  565 |   await expect(page.getByText("Đã chọn: 21.028500, 105.854200")).toBeVisible();
  566 | });
  567 | 
  568 | test("failed catalog and map retain manual entry; malformed uploads and foreign origins are denied", async ({
  569 |   page,
  570 | }) => {
  571 |   await page.route("**/api/locations/provinces", (route) =>
  572 |     route.fulfill({
  573 |       status: 503,
  574 |       json: {
  575 |         success: false,
  576 |         errorCode: "SERVICE_UNAVAILABLE",
  577 |         message: "Unavailable",
  578 |         data: null,
  579 |       },
  580 |     }),
  581 |   );
  582 |   await page.route("https://api.mapbox.com/**", (route) => route.abort());
  583 |   await login(page);
  584 |   await expect(page.getByText(/Chưa tải được gợi ý/)).toBeVisible();
  585 |   await fill(page, false);
  586 |   await page.getByRole("button", { name: "Chọn vị trí trên bản đồ" }).click();
  587 |   await expect(page.getByText(/Không tải được bản đồ/)).toBeVisible();
  588 |   await page
  589 |     .getByRole("dialog")
  590 |     .getByRole("button", { name: "Đóng hộp thoại", exact: true })
  591 |     .click();
  592 |   const malformed = await page.request.post("/api/backend/media", {
  593 |     headers: { origin: "http://localhost:3001" },
```