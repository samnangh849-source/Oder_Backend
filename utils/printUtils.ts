/**
 * printUtils.ts
 * Utility functions for handling printing operations.
 */

export const printViaIframe = (url: string) => {
    // Check if an iframe for printing already exists
    let iframe = document.getElementById('hidden-print-iframe') as HTMLIFrameElement;
    
    // If it doesn't exist, create it and hide it
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'hidden-print-iframe';
        // Use a more standard "hidden" approach that still allows printing
        iframe.style.position = 'fixed';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.width = '1px';
        iframe.style.height = '1px';
        iframe.style.opacity = '0.01';
        iframe.style.pointerEvents = 'none';
        iframe.style.border = 'none';
        iframe.style.zIndex = '-1';
        
        document.body.appendChild(iframe);
    }
    
    iframe.onload = () => {
        try {
            if (iframe.contentWindow) {
                iframe.contentWindow.focus();
                // If it's same-origin, we can try to help trigger it
                // but we mostly rely on the autoPrint script inside
            }
        } catch (e) {}
    };
    
    // Append autoPrint=true parameter to tell the Label page to auto-print itself
    try {
        const printUrl = new URL(url);
        if (!printUrl.searchParams.has('autoPrint')) {
            printUrl.searchParams.set('autoPrint', 'true');
        }
        iframe.src = printUrl.toString();
    } catch (e) {
        // Fallback for relative paths or invalid URLs
        iframe.src = url;
    }
};
