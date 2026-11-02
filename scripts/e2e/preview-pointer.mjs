export async function getRenderedPreviewRect(page, target) {
  await target.scrollIntoViewIfNeeded();
  const frame = await page
    .locator('iframe[title="Project preview"]')
    .boundingBox();
  const point = await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
  if (!frame || point.viewport.width <= 0 || point.viewport.height <= 0)
    throw new Error("Could not measure the preview target for pointer input");
  const scaleX = frame.width / point.viewport.width,
    scaleY = frame.height / point.viewport.height;
  return {
    x: frame.x + point.rect.x * scaleX,
    y: frame.y + point.rect.y * scaleY,
    width: point.rect.width * scaleX,
    height: point.rect.height * scaleY,
  };
}

export async function clickPreview(page, target, position) {
  await target.scrollIntoViewIfNeeded();
  const frame = await page
    .locator('iframe[title="Project preview"]')
    .boundingBox();
  const point = await target.evaluate((element, requested) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x + (requested?.x ?? rect.width / 2),
      y: rect.y + (requested?.y ?? rect.height / 2),
      width: innerWidth,
      height: innerHeight,
    };
  }, position);
  if (!frame || point.width <= 0 || point.height <= 0)
    throw new Error("Could not measure the preview target for pointer input");
  await page.mouse.click(
    frame.x + point.x * (frame.width / point.width),
    frame.y + point.y * (frame.height / point.height),
  );
  const sourceClasses = page.locator("details.source-class-controls");
  if (
    (await sourceClasses.count()) &&
    !(await sourceClasses.evaluate((details) => details.open))
  ) {
    await sourceClasses.locator("summary").click();
  }
}
