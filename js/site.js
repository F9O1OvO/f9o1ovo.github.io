(function () {
    'use strict';

    var themeKey = 'site-theme';
    var themeToggle = document.getElementById('theme-toggle');

    function setTheme(theme) {
        var isDark = theme === 'dark';
        document.body.classList.toggle('dark-mode', isDark);
        document.documentElement.classList.toggle('dark-mode-pending', isDark);
        if (themeToggle) {
            themeToggle.innerHTML = '<i class="fa fa-' + (isDark ? 'sun-o' : 'moon-o') + '"></i>';
            themeToggle.title = isDark ? '切换浅色模式' : '切换深色模式';
            themeToggle.setAttribute('aria-label', themeToggle.title);
        }
    }

    setTheme(localStorage.getItem(themeKey) === 'dark' ? 'dark' : 'light');
    if (themeToggle) {
        themeToggle.addEventListener('click', function () {
            var next = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
            localStorage.setItem(themeKey, next);
            setTheme(next);
        });
    }

    var topButton = document.getElementById('site-scroll-top');
    var progress = document.getElementById('reading-progress');

    function onScroll() {
        var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        if (topButton) topButton.classList.toggle('is-visible', scrollTop > 420);
        if (progress) {
            var pageHeight = document.documentElement.scrollHeight - window.innerHeight;
            progress.style.width = (pageHeight > 0 ? Math.min(scrollTop / pageHeight * 100, 100) : 0) + '%';
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (topButton) {
        topButton.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    var lightbox;
    function closeLightbox() {
        if (!lightbox) return;
        lightbox.parentNode.removeChild(lightbox);
        lightbox = null;
    }

    document.addEventListener('click', function (event) {
        var image = event.target;
        if (!image.matches || !image.matches('article .post-body img')) return;
        event.preventDefault();
        lightbox = document.createElement('div');
        lightbox.className = 'image-lightbox';
        lightbox.setAttribute('role', 'dialog');
        lightbox.setAttribute('aria-label', '查看大图，点击任意位置关闭');
        var largeImage = document.createElement('img');
        largeImage.src = image.currentSrc || image.src;
        largeImage.alt = image.alt || '';
        lightbox.appendChild(largeImage);
        lightbox.addEventListener('click', closeLightbox);
        document.body.appendChild(lightbox);
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeLightbox();
    });

    var copyButton = document.querySelector('.post-copy-link');
    if (copyButton) {
        copyButton.addEventListener('click', function () {
            var link = copyButton.getAttribute('data-link') || window.location.href;
            var done = function () {
                var original = copyButton.innerHTML;
                copyButton.innerHTML = '<i class="fa fa-check"></i> 已复制';
                setTimeout(function () { copyButton.innerHTML = original; }, 1800);
            };
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(link).then(done);
                return;
            }
            var helper = document.createElement('textarea');
            helper.value = link;
            helper.style.position = 'fixed';
            helper.style.opacity = '0';
            document.body.appendChild(helper);
            helper.select();
            document.execCommand('copy');
            document.body.removeChild(helper);
            done();
        });
    }
})();
