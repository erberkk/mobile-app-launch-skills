// Example: attach a large local file (e.g. an AAB or a video over 50 MB) to a file input.
// Playwright's setInputFiles over a CDP connection sends file contents through the protocol and
// fails for large files. DOM.setFileInputFiles passes only the path; Chrome reads the file itself.
//   FILE=/abs/path/app-release.aab node runner.mjs --tab "play.google.com/console" steps/upload-large-file.mjs
export default async (page, ctx) => {
  const file = ctx.env.FILE;
  if (!file) return "set FILE=<absolute path>";
  const cdp = await ctx.cdp();
  const { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "input[type=file]" });
  if (!nodeId) return "no file input on the page (some consoles create it only after clicking 'Upload')";
  await cdp.send("DOM.setFileInputFiles", { nodeId, files: [file] });
  // Wait for the console to show the processed file; adjust the text to your console.
  await page.waitForTimeout(5000);
  return await ctx.text(20, "Upload");
};

// Downloads (e.g. a generated key file) are lost over CDP unless you allow them:
//   const cdp = await ctx.cdp();
//   await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: "/secure/dir", eventsEnabled: true });
