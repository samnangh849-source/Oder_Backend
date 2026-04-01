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
        iframe.style.visibility = 'hidden';
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        
        // Append it to the body
        document.body.appendChild(iframe);
    }
    
    iframe.onload = () => {
        // For Cross-Origin URLs (like Google Apps Script), we cannot call iframe.contentWindow.print()
        // due to browser security policies (Same-Origin Policy).
        // 
        // IMPORTANT: The target URL's HTML MUST include the following script to trigger the print dialog itself:
        // <script> window.onload = function() { window.print(); } </script>
        console.log("Iframe loaded label. Awaiting self-print from the label's script...");
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
