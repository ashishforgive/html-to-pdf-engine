Plugin Architecture
engine.addPlugin("watermark");
engine.addPlugin("pageNumbers");
engine.addPlugin("digitalSignature");


Plugin lifecycle hooks:
beforeInlineAssets()
afterInlineAssets()
beforeLayout()
afterLayout()
beforeRenderPage(page)
afterRenderPage(page)
beforeWritePDF()
afterWritePDF()
