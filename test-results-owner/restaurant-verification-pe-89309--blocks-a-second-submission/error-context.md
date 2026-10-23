# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: restaurant-verification.spec.ts >> pending state is read-only and a concurrent VERIFICATION_ALREADY_PENDING blocks a second submission
- Location: tests\browser\restaurant-verification.spec.ts:420:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('dialog', { name: 'Tải lại và bỏ thay đổi?', exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('dialog', { name: 'Tải lại và bỏ thay đổi?', exact: true }) with timeout 10000ms
  - waiting for getByRole('dialog', { name: 'Tải lại và bỏ thay đổi?', exact: true })

```

```yaml
- link "Đến nội dung chính":
  - /url: "#main-content"
- banner:
  - link "ANGI — Trang chủ":
    - /url: /restaurant
    - text: ANGI
  - navigation "Điều hướng nhà hàng":
    - link "Tổng quan":
      - /url: /restaurant
    - link "Nhà hàng":
      - /url: /restaurant/profile
    - link "Xác minh":
      - /url: /restaurant/verification
    - link "Thực đơn":
      - /url: /restaurant/menu
  - group: C
- main:
  - paragraph: Nhà hàng của tôi
  - heading "Xác minh nhà hàng" [level=1]
  - paragraph: Gửi thông tin pháp lý và tài liệu để yêu cầu xác minh nhà hàng.
  - strong: Bún Bò Bà Diệu
  - paragraph: "Trạng thái nhà hàng: Chờ xác minh"
  - button "Tải lại trạng thái"
  - tablist "Lựa chọn":
    - tab "Trạng thái xác minh" [selected]
    - tab "Hồ sơ xác minh"
  - paragraph: "Trạng thái xác minh nhà hàng: Chờ xác minh"
  - button "Tải lại lịch sử"
  - heading "Hồ sơ gần nhất" [level=2]
  - paragraph: "Mã hồ sơ: #21 · Chờ duyệt"
  - term: Tên pháp lý
  - definition: Hộ kinh doanh Bún Bò Bà Diệu
  - term: Số giấy phép kinh doanh
  - definition: 32A8012345
  - term: Mã số thuế
  - definition: "0401234567"
  - term: Ngày gửi
  - definition: 10:00:00 1/10/2026
  - term: Ghi chú của bạn
  - definition: Bổ sung giấy ATTP
  - term: Người duyệt
  - definition: Chưa có
  - term: Ngày phản hồi
  - definition: Chưa có
  - term: Phản hồi của người duyệt
  - definition: Chưa có phản hồi.
  - list:
    - listitem:
      - link "Giấy phép kinh doanh 1":
        - /url: https://example.invalid/private-license.pdf
  - paragraph: Liên kết tài liệu chỉ được mở khi bạn bấm. Nếu hết hạn, tải lại trạng thái hoặc lịch sử để lấy liên kết mới.
  - status: Hồ sơ đang chờ duyệt. Bạn có thể tải lại để xem phản hồi mới.
  - heading "Lịch sử hồ sơ" [level=2]
  - paragraph: 1 hồ sơ · Mới nhất trước
  - list:
    - listitem:
      - strong: "Hồ sơ #21 · Mới nhất"
      - paragraph: "Ngày gửi: 10:00:00 1/10/2026"
      - text: Chờ duyệt
      - 'button "Xem hồ sơ #21"'
- contentinfo:
  - link "ANGI — Trang chủ":
    - /url: /
    - text: ANGI
  - paragraph: Không gian dành cho thành viên ANGI.
  - navigation "Điều hướng cuối trang":
    - link "Trang chủ ANGI":
      - /url: /
  - text: ANGI · Hương vị Việt, theo cách của bạn.
- alert
```

# Test source

```ts
  352 |     .getByLabel("Loại tài liệu · first.pdf", { exact: true })
  353 |     .selectOption("business_license");
  354 |   await submit(page).click();
  355 |   await confirm(page).click();
  356 |   await expect(
  357 |     page.getByText("Đã gửi hồ sơ xác minh. Trạng thái: Chờ duyệt.", {
  358 |       exact: true,
  359 |     }),
  360 |   ).toBeVisible();
  361 |   expect(submissions[0].documents).toEqual([
  362 |     { docType: "business_license", mediaId: 9001 },
  363 |     { docType: "id_card", mediaId: 9003 },
  364 |   ]);
  365 | });
  366 | 
  367 | test("backend field errors focus the field, retain uploaded IDs and the draft; network failure permits retry", async ({
  368 |   page,
  369 | }) => {
  370 |   await ready(page);
  371 |   nextError = {
  372 |     status: 400,
  373 |     errorCode: "VALIDATION_FAILED",
  374 |     errors: {
  375 |       LegalName: ["Tên pháp lý cần sửa."],
  376 |       "Documents[0].MediaId": ["Tài liệu cần kiểm tra."],
  377 |     },
  378 |   };
  379 |   await submit(page).click();
  380 |   await confirm(page).click();
  381 |   await expect(
  382 |     page.getByText("Tên pháp lý cần sửa.", { exact: true }),
  383 |   ).toBeVisible();
  384 |   await expect(
  385 |     page.getByText("Tài liệu cần kiểm tra.", { exact: true }),
  386 |   ).toBeVisible();
  387 |   await expect(legalName(page)).toBeFocused();
  388 |   await expect(license(page)).toHaveValue(
  389 |     `  ${verificationRequestSample.businessLicenseNo}  `,
  390 |   );
  391 |   nextError = { status: 503, errorCode: "SERVICE_UNAVAILABLE" };
  392 |   await legalName(page).fill("Tên đã sửa");
  393 |   await submit(page).click();
  394 |   await confirm(page).click();
  395 |   await expect(
  396 |     page.getByText("Hiện chưa kết nối được với hệ thống.", { exact: true }),
  397 |   ).toBeVisible();
  398 |   await expect(legalName(page)).toHaveValue("Tên đã sửa");
  399 |   await submit(page).click();
  400 |   await confirm(page).click();
  401 |   await expect(
  402 |     page.getByText("Đã gửi hồ sơ xác minh. Trạng thái: Chờ duyệt.", {
  403 |       exact: true,
  404 |     }),
  405 |   ).toBeVisible();
  406 |   expect(uploads).toHaveLength(1);
  407 |   expect(submissions).toHaveLength(3);
  408 |   expect(submissions[2]).toEqual({
  409 |     legalName: "Tên đã sửa",
  410 |     businessLicenseNo: verificationRequestSample.businessLicenseNo,
  411 |     documents: verificationRequestSample.documents,
  412 |   });
  413 | });
  414 | 
  415 | for (const [status, errorCode] of [
  416 |   ["pending", "VERIFICATION_ALREADY_PENDING"],
  417 |   ["verified", "RESTAURANT_ALREADY_VERIFIED"],
  418 |   ["rejected", "VERIFICATION_RESUBMIT_REQUIRED"],
  419 | ] as const) {
  420 |   test(`${status} state is read-only and a concurrent ${errorCode} blocks a second submission`, async ({
  421 |     page,
  422 |   }) => {
  423 |     await ready(page);
  424 |     nextError = { status: 409, errorCode };
  425 |     if (!current) throw new Error("The test owner fixture is missing.");
  426 |     current = {
  427 |       ...current,
  428 |       verificationStatus: status,
  429 |       latestVerification: {
  430 |         ...verificationSample,
  431 |         status:
  432 |           status === "verified"
  433 |             ? "approved"
  434 |             : status === "rejected"
  435 |               ? "needs_more_info"
  436 |               : "pending",
  437 |       },
  438 |     };
  439 |     await submit(page).click();
  440 |     await confirm(page).click();
  441 |     await expect(page.getByRole("dialog")).toHaveCount(0);
  442 |     await expect(legalName(page)).toHaveCount(0);
  443 |     expect(submissions).toHaveLength(1);
  444 |     await page
  445 |       .getByRole("button", { name: "Tải lại trạng thái", exact: true })
  446 |       .click();
  447 |     await expect(
  448 |       page.getByRole("dialog", {
  449 |         name: "Tải lại và bỏ thay đổi?",
  450 |         exact: true,
  451 |       }),
> 452 |     ).toBeVisible();
      |       ^ Error: expect(locator).toBeVisible() failed
  453 |     await page
  454 |       .getByRole("dialog")
  455 |       .getByRole("button", { name: "Bỏ thay đổi", exact: true })
  456 |       .click();
  457 |     await expect(
  458 |       page.getByRole("heading", { name: "Hồ sơ gần nhất", exact: true }),
  459 |     ).toBeVisible();
  460 |     await page
  461 |       .getByRole("tab", { name: "Hồ sơ xác minh", exact: true })
  462 |       .click();
  463 |     await expect(submit(page)).toHaveCount(0);
  464 |     expect(submissions).toHaveLength(1);
  465 |   });
  466 | }
  467 | 
  468 | test("remove/discard/refresh require modals and mobile layouts stay within the viewport", async ({
  469 |   page,
  470 | }) => {
  471 |   await page.setViewportSize({ width: 390, height: 844 });
  472 |   await ready(page);
  473 |   await page
  474 |     .getByRole("button", { name: "Bỏ tài liệu license.pdf", exact: true })
  475 |     .click();
  476 |   await page
  477 |     .getByRole("dialog")
  478 |     .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
  479 |     .click();
  480 |   await expect(
  481 |     page.getByLabel("Loại tài liệu · license.pdf", { exact: true }),
  482 |   ).toBeVisible();
  483 |   await page
  484 |     .getByRole("button", { name: "Bỏ tài liệu license.pdf", exact: true })
  485 |     .click();
  486 |   await page
  487 |     .getByRole("dialog")
  488 |     .getByRole("button", { name: "Bỏ tài liệu", exact: true })
  489 |     .click();
  490 |   await expect(
  491 |     page.getByLabel("Loại tài liệu · license.pdf", { exact: true }),
  492 |   ).toHaveCount(0);
  493 |   await page.getByRole("button", { name: "Hủy thay đổi", exact: true }).click();
  494 |   await page
  495 |     .getByRole("dialog")
  496 |     .getByRole("button", { name: "Bỏ thay đổi", exact: true })
  497 |     .click();
  498 |   await expect(legalName(page)).toHaveValue("");
  499 |   await legalName(page).fill("Chưa lưu");
  500 |   await page
  501 |     .getByRole("button", { name: "Tải lại trạng thái", exact: true })
  502 |     .click();
  503 |   await page.keyboard.press("Escape");
  504 |   await expect(legalName(page)).toHaveValue("Chưa lưu");
  505 |   expect(
  506 |     await page.evaluate(
  507 |       () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  508 |     ),
  509 |   ).toBe(true);
  510 |   await page.screenshot({
  511 |     path: "artifacts/verification-mobile.png",
  512 |     fullPage: true,
  513 |   });
  514 |   expect(submissions).toHaveLength(0);
  515 | });
  516 | 
  517 | test("initial GET failure is retryable and absent restaurants link to registration", async ({
  518 |   page,
  519 | }) => {
  520 |   await login(page);
  521 |   failGet = true;
  522 |   await page.goto("/restaurant/verification");
  523 |   await expect(
  524 |     page.getByRole("heading", {
  525 |       name: "Chưa tải được hồ sơ nhà hàng",
  526 |       exact: true,
  527 |     }),
  528 |   ).toBeVisible();
  529 |   failGet = false;
  530 |   await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  531 |   await expect(legalName(page)).toBeVisible();
  532 |   current = null;
  533 |   await page.reload();
  534 |   await expect(
  535 |     page.getByRole("heading", {
  536 |       name: "Bạn chưa đăng ký nhà hàng",
  537 |       exact: true,
  538 |     }),
  539 |   ).toBeVisible();
  540 |   await expect(
  541 |     page.getByRole("link", { name: "Đăng ký nhà hàng", exact: true }),
  542 |   ).toHaveAttribute("href", "/restaurant/register");
  543 | });
  544 | 
  545 | test("anonymous, wrong roles, foreign Origin and unlisted methods cannot reach OWN-06", async ({
  546 |   page,
  547 | }) => {
  548 |   const url = "/api/backend/owner/restaurant/verifications";
  549 |   const headers = { origin: "http://localhost:3001" };
  550 |   expect(
  551 |     (
  552 |       await page.request.post(url, { headers, data: verificationRequestSample })
```