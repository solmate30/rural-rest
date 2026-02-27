const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    // 1. Launch a headless browser
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // 2. We need to print at a 16:9 aspect ratio mapping to the 1280x720 slide size.
    await page.setViewport({ width: 1280, height: 720 });

    // 3. Load the local HTML file
    const filePath = path.join(__dirname, 'docs', '02_UI_Screens', 'PITCH_DECK_SLIDE.html');
    await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0' });

    // 4. Inject a style to force the active slide to be visible for printing,
    // and hide the navigation elements & gradient blobs that cause issues.
    await page.evaluate(() => {
        // We'll iterate through each slide to make them print sequentially
        // For PDF printing, we want all slides to be static and stacked vertically.
        const style = document.createElement('style');
        style.innerHTML = `
            @media print {
                body, html { width: 1280px; height: auto !important; overflow: visible !important; }
                #deck { display: block !important; height: auto !important; width: 1280px !important; }
                
                .slide {
                    position: relative !important;
                    page-break-after: always !important;
                    page-break-inside: avoid !important;
                    opacity: 1 !important;
                    transform: none !important;
                    width: 1280px !important;
                    height: 720px !important;
                    display: block !important;
                    margin: 0 !important;
                    border: none !important;
                }
                
                /* Hide navigation, blobs, hints */
                #hint, .nav-btn, #progress-text, .dots { display: none !important; }
                
                /* Ensure background colors are printed */
                * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
            }
        `;
        document.head.appendChild(style);
    });

    // 5. Generate the PDF
    const outputPath = path.join(__dirname, 'docs', '02_UI_Screens', 'Pitch_Deck.pdf');
    await page.pdf({
        path: outputPath,
        printBackground: true,
        width: '1280px',
        height: '720px',
        margin: { top: 0, bottom: 0, left: 0, right: 0 }
    });

    await browser.close();
    console.log(`PDF successfully generated at: ${outputPath}`);
})();
