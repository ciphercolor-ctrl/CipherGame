// Homepage-specific Lenis Initialization
// This script should only be loaded on the main page (index.html)

// Create the Lenis instance and attach it to the window object
// so that main.js can conditionally use it.
window.lenisInstance = new Lenis();

function raf(time) {
    window.lenisInstance.raf(time);
    requestAnimationFrame(raf);
}

requestAnimationFrame(raf);