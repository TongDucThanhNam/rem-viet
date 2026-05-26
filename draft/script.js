document.addEventListener('DOMContentLoaded', () => {
    // Check if Motion is loaded
    if (typeof Motion === 'undefined') {
        console.error('Motion library not loaded.');
        return;
    }
    const { animate, scroll, inView, stagger } = Motion;

    // --- Lenis Smooth Scrolling ---
    const lenis = new Lenis({
        duration: 1.5,
        easing: (t) => 1 - Math.pow(1 - t, 4), // Quartic out for luxury feel
        direction: 'vertical',
        gestureDirection: 'vertical',
        smooth: true,
        mouseMultiplier: 1,
        smoothTouch: false,
        touchMultiplier: 2,
        infinite: false,
    });

    // --- Custom Cursor ---
    const cursor = document.querySelector('.cursor');
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorText = document.querySelector('.cursor-text');
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let cursorX = mouseX;
    let cursorY = mouseY;

    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    // --- Unified RAF Loop ---
    function raf(time) {
        lenis.raf(time);
        
        // Smooth cursor follow (softer floaty feel)
        cursorX += (mouseX - cursorX) * 0.1;
        cursorY += (mouseY - cursorY) * 0.1;
        cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
        
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Hover states for cursor
    const hoverTargets = document.querySelectorAll('.hover-target');
    hoverTargets.forEach(target => {
        target.addEventListener('mouseenter', () => {
            const text = target.getAttribute('data-cursor');
            if (text) {
                cursorText.textContent = text;
                cursor.classList.add('has-text');
            } else {
                cursor.classList.add('hovering');
            }
        });
        target.addEventListener('mouseleave', () => {
            cursor.classList.remove('hovering');
            cursor.classList.remove('has-text');
            cursorText.textContent = '';
        });
    });

    // --- Magnetic Buttons ---
    const magneticTargets = document.querySelectorAll('.nav-links a, .btn-explore');
    magneticTargets.forEach(target => {
        target.addEventListener('mousemove', (e) => {
            const rect = target.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            // AWWWARDS organic spring pull
            animate(target, { x: x * 0.3, y: y * 0.3 }, { type: "spring", bounce: 0.15, duration: 0.6 });
        });
        
        target.addEventListener('mouseleave', () => {
            animate(target, { x: 0, y: 0 }, { type: "spring", bounce: 0.4, duration: 0.8 });
        });
    });

    // --- Loader ---
    const counterEl = document.querySelector('.loader-counter');
    
    // Simulate loading with Motion animate
    animate(0, 100, {
        duration: 2,
        ease: [0.76, 0, 0.24, 1],
        onUpdate: (latest) => {
            counterEl.textContent = Math.round(latest) + '%';
        },
        onComplete: finishLoading
    });

    function finishLoading() {
        // Animate counter out
        animate(counterEl, { opacity: 0, y: -50 }, { duration: 0.5, ease: [0.19, 1, 0.22, 1] });
        
        // Split overlays
        animate('.loader-overlay-top', { scaleY: 0 }, { duration: 1, ease: [0.76, 0, 0.24, 1], delay: 0.2 });
        animate('.loader-overlay-bottom', { scaleY: 0 }, { 
            duration: 1, 
            ease: [0.76, 0, 0.24, 1], 
            delay: 0.2,
            onComplete: () => {
                document.querySelector('.loader').style.display = 'none';
                document.body.classList.remove('is-loading');
                initEntrance();
            }
        });
    }

    // --- Entrance Animations ---
    function initEntrance() {
        // Hero Words
        animate('.hero-heading .word', 
            { y: ['100%', '0%'] }, 
            { duration: 1.2, delay: stagger(0.1), ease: [0.19, 1, 0.22, 1] }
        );

        // Hero Description & Button
        animate('.hero-desc p, .btn-explore', 
            { opacity: [0, 1], y: [20, 0] }, 
            { duration: 1, delay: stagger(0.2, { startDelay: 0.6 }), ease: [0.19, 1, 0.22, 1] }
        );

        // Hero Image Mask
        animate('.hero-visual .img-mask', 
            { clipPath: ['inset(100% 0 0 0)', 'inset(0% 0 0 0)'] }, 
            { duration: 1.5, delay: 0.8, ease: [0.76, 0, 0.24, 1] }
        );
        animate('.hero-visual img', 
            { scale: [1.2, 1] }, 
            { duration: 1.5, delay: 0.8, ease: [0.76, 0, 0.24, 1] }
        );
    }

    // --- Scroll Animations ---
    
    // Parallax Images
    const parallaxImages = document.querySelectorAll('.parallax-img');
    parallaxImages.forEach(img => {
        const speed = parseFloat(img.getAttribute('data-speed')) || 0.1;
        scroll(
            animate(img, { y: [0, window.innerHeight * speed] }),
            { target: img.parentElement, offset: ["start end", "end start"] }
        );
    });

    // AWWWARDS Image Reveal (ScrollImageReveal)
    const reveals = document.querySelectorAll('.js-reveal');
    reveals.forEach(container => {
        const mask = container.querySelector('.reveal-mask');
        const img = container.querySelector('.reveal-img');
        
        scroll(
            animate(mask, { 
                clipPath: ["inset(0% 50% 0% 50%)", "inset(0% 0% 0% 0%)", "inset(0% 0% 0% 0%)"]
            }, {
                offset: [0, 0.4, 1]
            }),
            { target: container, offset: ["start end", "end start"] }
        );

        scroll(
            animate(img, { 
                scale: [1.3, 1, 1.1],
                y: ["0%", "8%", "20%"]
            }, {
                offset: [0, 0.4, 1]
            }),
            { target: container, offset: ["start end", "end start"] }
        );
    });

    // --- Horizontal Gallery ---
    const horizontalSection = document.querySelector('.horizontal-scroll');
    const horizontalTrack = document.querySelector('.js-horizontal-track');
    if (horizontalSection && horizontalTrack) {
        scroll(
            animate(horizontalTrack, { x: ["0vw", "-220vw"] }),
            { target: horizontalSection, offset: ["start end", "end start"] }
        );
    }

    // Mask Reveals on Scroll (Old ones)
    const masks = document.querySelectorAll('.details-visual .img-mask, .portrait-mask');
    masks.forEach(mask => {
        inView(mask, () => {
            animate(mask, { clipPath: ['inset(100% 0 0 0)', 'inset(0% 0 0 0)'] }, { duration: 1.5, ease: [0.76, 0, 0.24, 1] });
            const img = mask.querySelector('img');
            if(img) animate(img, { scale: [1.2, 1] }, { duration: 1.5, ease: [0.76, 0, 0.24, 1] });
        }, { margin: "-10% 0px" });
    });

    // Text Reveals
    inView('.details-intro p', (info) => {
        animate(info.target, { opacity: [0, 1], y: [30, 0] }, { duration: 1, ease: [0.19, 1, 0.22, 1] });
    }, { margin: "-20% 0px" });

    // Accordion (Using CSS Grid transition)
    const accItems = document.querySelectorAll('.acc-item');
    accItems.forEach(item => {
        const head = item.querySelector('.acc-head');
        const icon = item.querySelector('.acc-icon');
        
        head.addEventListener('click', () => {
            const isOpen = item.classList.contains('is-open');
            
            // Close all
            accItems.forEach(otherItem => {
                otherItem.classList.remove('is-open');
                otherItem.querySelector('.acc-icon').textContent = '+';
            });
            
            // Open clicked if it wasn't open
            if (!isOpen) {
                item.classList.add('is-open');
                icon.textContent = '-';
            }
        });
    });
});
