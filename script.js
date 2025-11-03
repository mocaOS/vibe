// Infinite Marquee Animation
function initMarquee() {
  const marqueeContent = document.getElementById('marqueeContent');
  const marqueeText = marqueeContent.querySelector('.marquee-text');

  // Add enough clones to fill viewport and ensure seamless scrolling
  // We'll add multiple copies to avoid any gaps
  const numCopies = 3;
  for (let i = 0; i < numCopies; i++) {
    const clone = marqueeText.cloneNode(true);
    marqueeContent.appendChild(clone);
  }

  let position = 0;
  const speed = 0.3; // pixels per frame

  function animate() {
    position -= speed;

    // Get the width of one text element
    const textWidth = marqueeText.offsetWidth;

    // Reset position when first copy has completely scrolled off
    if (Math.abs(position) >= textWidth) {
      position = 0;
    }

    marqueeContent.style.transform = `translateX(${position}px)`;
    requestAnimationFrame(animate);
  }

  // Start animation immediately
  requestAnimationFrame(animate);
}

// Initialize marquee as early as possible
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMarquee);
} else {
  initMarquee();
}

// Simple markdown renderer for long descriptions
function renderMarkdown(text) {
  // Convert headers
  text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Convert markdown links [text](url) to HTML links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank">$1</a>');

  // Convert bold and italic
  text = text.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/gim, '<em>$1</em>');

  // Convert blockquotes
  text = text.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

  // Convert lists
  text = text.replace(/^\- (.*$)/gim, '<li>$1</li>');
  text = text.replace(/<\/li>\s<li>/gim, '</li><li>');
  text = text.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');

  text = text.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');
  text = text.replace(/(<li>.*<\/li>)/gim, '<ol>$1</ol>');

  // Handle paragraphs (separated by double newlines)
  const paragraphs = text.split('\n\n');
  for (let i = 0; i < paragraphs.length; i++) {
    // Skip if already wrapped in a tag
    if (!paragraphs[i].match(/^<(h[1-6]|ul|ol|blockquote|strong|em|a)/)) {
      // Replace single newlines with <br> within paragraphs
      paragraphs[i] = paragraphs[i].replace(/\n/g, '<br>');
      // Wrap in paragraph tag if not empty
      if (paragraphs[i].trim() !== '') {
        paragraphs[i] = `<p>${paragraphs[i]}</p>`;
      }
    }
  }
  text = paragraphs.join('');

  // Clean up empty paragraphs
  text = text.replace(/<p><br><\/p>/g, '');
  text = text.replace(/<p><\/p>/g, '');

  return text;
}

// Pagination variables
const APPS_PER_PAGE = 12;
let currentPage = 1;
let appsData = [];
let appsTypes = [];
let activeFilters = new Set(); // Track active type filters
let typeColorMap = {}; // Map slug to color

// Tooltip scroll management
let activeTooltipAnimation = null;
let currentAnimatedCard = null;

// Load apps and populate the grid
document.addEventListener('DOMContentLoaded', function() {
  const appGrid = document.getElementById('appGrid');

  // Fetch both apps data and types data
  Promise.all([
    fetch('appsData.json').then(response => response.json()),
    fetch('appsTypes.json').then(response => response.json())
  ])
    .then(([apps, types]) => {
      appsData = apps;
      appsTypes = types;

      // Create type color map
      types.forEach(type => {
        typeColorMap[type.slug] = type.color;
      });

      displayTypeFilters();
      displayApps(currentPage);
      setupPagination();
    })
    .catch(error => {
      console.error('Error loading data:', error);
      // Fallback to showing an error message in the grid
      appGrid.innerHTML = '<p class="error-message">Failed to load applications data.</p>';
    });

  // Modal functionality
  const modal = document.getElementById('detailsModal');
  const closeBtn = document.querySelector('.close');

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });

  // Keyboard navigation
  document.addEventListener('keydown', (event) => {
    // Only handle keyboard events when modal is not open
    const isModalOpen = modal.style.display === 'block';

    // Handle ESC key to close modal
    if (event.key === 'Escape' && isModalOpen) {
      modal.style.display = 'none';
      return;
    }

    // Handle arrow keys for pagination only when modal is closed
    if (!isModalOpen) {
      // Prevent default behavior for arrow keys to avoid page scrolling
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();

        if (event.key === 'ArrowLeft' && currentPage > 1) {
          currentPage--;
          displayApps(currentPage);
          setupPagination();
        } else if (event.key === 'ArrowRight' && currentPage < Math.ceil(getFilteredApps().length / APPS_PER_PAGE)) {
          currentPage++;
          displayApps(currentPage);
          setupPagination();
        }
      }
    }
  });
});

// Display type filter buttons
function displayTypeFilters() {
  const typeFilters = document.getElementById('typeFilters');
  typeFilters.innerHTML = '';

  // Add count button first
  const countButton = document.createElement('button');
  countButton.className = 'type-filter-button count-button';
  countButton.textContent = `${appsData.length} Apps`;
  countButton.disabled = true;
  typeFilters.appendChild(countButton);

  appsTypes.forEach(type => {
    const button = document.createElement('button');
    button.className = 'type-filter-button';
    button.textContent = type.name;
    button.dataset.slug = type.slug;
    button.style.setProperty('--type-color', type.color);

    button.addEventListener('click', () => {
      toggleFilter(type.slug, button);
    });

    typeFilters.appendChild(button);
  });
}

// Toggle filter on/off
function toggleFilter(slug, button) {
  if (activeFilters.has(slug)) {
    activeFilters.delete(slug);
    button.classList.remove('active');
  } else {
    activeFilters.add(slug);
    button.classList.add('active');
  }

  // Reset to first page when filter changes
  currentPage = 1;
  displayApps(currentPage);
  setupPagination();
}

// Get filtered apps based on active filters
function getFilteredApps() {
  if (activeFilters.size === 0) {
    return appsData;
  }
  return appsData.filter(app => activeFilters.has(app.type));
}

// Display apps for the current page
function displayApps(page) {
  const appGrid = document.getElementById('appGrid');
  const filteredApps = getFilteredApps();
  const startIndex = (page - 1) * APPS_PER_PAGE;
  const endIndex = startIndex + APPS_PER_PAGE;
  const appsToDisplay = filteredApps.slice(startIndex, endIndex);

  appGrid.innerHTML = '';

  // Add actual apps
  appsToDisplay.forEach(app => {
    const appCard = document.createElement('div');
    appCard.className = 'app-card';
    appCard.dataset.appId = app.id;

    // Set the border color and title color based on app type
    const typeColor = typeColorMap[app.type] || '#FFFFFF';
    appCard.style.setProperty('--app-border-color', typeColor);
    appCard.style.setProperty('--app-title-color', typeColor);

    appCard.innerHTML = `
      <img src="${app.img}" alt="${app.title}" class="app-icon" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'80\\' height=\\'80\\' viewBox=\\'0 0 24 24\\'><rect width=\\'24\\' height=\\'24\\' fill=\\'%232a2a2a\\'/><path fill=\\'%23cccccc\\' d=\\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z\\'/></svg>'">

      <div class="tooltip">
        <div class="tooltip-text">${app.shortDescription}</div>
      </div>
      <h3 class="app-title">${app.title}</h3>
      ${app.url && app.url.trim() !== '' ? `<a href="${app.url}" target="_blank" class="play-button" onclick="event.stopPropagation()">▶</a>` : ''}
    `;

    // Add tooltip scroll animation on hover
    const tooltip = appCard.querySelector('.tooltip');
    const tooltipText = appCard.querySelector('.tooltip-text');

    // Mouse events for desktop
    appCard.addEventListener('mouseenter', () => {
      startTooltipScroll(tooltip, tooltipText, appCard);
    });

    appCard.addEventListener('mouseleave', () => {
      stopTooltipScroll(tooltipText);
    });

    // Touch events for mobile
    appCard.addEventListener('touchstart', (e) => {
      // Add active class to show tooltip immediately
      appCard.classList.add('active');
      // Start scrolling immediately on touch
      startTooltipScroll(tooltip, tooltipText, appCard);
    }, { passive: true });

    appCard.addEventListener('touchend', () => {
      // Remove active class to hide tooltip
      appCard.classList.remove('active');
      stopTooltipScroll(tooltipText);
    });

    appCard.addEventListener('touchcancel', () => {
      // Remove active class to hide tooltip
      appCard.classList.remove('active');
      stopTooltipScroll(tooltipText);
    });

    appCard.addEventListener('click', () => showAppDetails(app));
    appGrid.appendChild(appCard);
  });

  // Add filler items to maintain consistent grid height
  const fillerCount = APPS_PER_PAGE - appsToDisplay.length;
  for (let i = 0; i < fillerCount; i++) {
    const fillerCard = document.createElement('div');
    fillerCard.className = 'app-card filler-card';
    fillerCard.innerHTML = `
      <div class="filler-content">
        <div class="filler-icon"></div>
        <div class="filler-title"></div>
        <div class="filler-description"></div>
      </div>
    `;
    appGrid.appendChild(fillerCard);
  }
}

// Setup pagination controls
function setupPagination() {
  const pagination = document.getElementById('pagination');
  const filteredApps = getFilteredApps();
  const pageCount = Math.ceil(filteredApps.length / APPS_PER_PAGE);

  pagination.innerHTML = '';

  // Previous button
  const prevButton = document.createElement('button');
  prevButton.className = 'pagination-button';
  prevButton.innerHTML = '&laquo;';
  prevButton.disabled = currentPage === 1;
  prevButton.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      displayApps(currentPage);
      setupPagination();
    }
  });
  pagination.appendChild(prevButton);

  // Page buttons
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(pageCount, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  // First page
  if (startPage > 1) {
    const firstButton = document.createElement('button');
    firstButton.className = `pagination-button ${currentPage === 1 ? 'active' : ''}`;
    firstButton.textContent = '1';
    firstButton.addEventListener('click', () => {
      currentPage = 1;
      displayApps(currentPage);
      setupPagination();
    });
    pagination.appendChild(firstButton);

    if (startPage > 2) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'pagination-ellipsis';
      ellipsis.innerHTML = '&hellip;';
      pagination.appendChild(ellipsis);
    }
  }

  // Page numbers
  for (let i = startPage; i <= endPage; i++) {
    const pageButton = document.createElement('button');
    pageButton.className = `pagination-button ${i === currentPage ? 'active' : ''}`;
    pageButton.textContent = i;
    pageButton.addEventListener('click', () => {
      currentPage = i;
      displayApps(currentPage);
      setupPagination();
    });
    pagination.appendChild(pageButton);
  }

  // Last page
  if (endPage < pageCount) {
    if (endPage < pageCount - 1) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'pagination-ellipsis';
      ellipsis.innerHTML = '&hellip;';
      pagination.appendChild(ellipsis);
    }

    const lastButton = document.createElement('button');
    lastButton.className = `pagination-button ${currentPage === pageCount ? 'active' : ''}`;
    lastButton.textContent = pageCount;
    lastButton.addEventListener('click', () => {
      currentPage = pageCount;
      displayApps(currentPage);
      setupPagination();
    });
    pagination.appendChild(lastButton);
  }

  // Next button
  const nextButton = document.createElement('button');
  nextButton.className = 'pagination-button';
  nextButton.innerHTML = '&raquo;';
  nextButton.disabled = currentPage === pageCount;
  nextButton.addEventListener('click', () => {
    if (currentPage < pageCount) {
      currentPage++;
      displayApps(currentPage);
      setupPagination();
    }
  });
  pagination.appendChild(nextButton);
}

// Show app details in modal
function showAppDetails(app) {
  const appDetails = document.getElementById('appDetails');

  appDetails.innerHTML = `
    <div class="app-details-header">
      <img src="${app.img}" alt="${app.title}" class="app-details-icon" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'100\\' viewBox=\\'0 0 24 24\\'><rect width=\\'24\\' height=\\'24\\' fill=\\'%232a2a2a\\'/><path fill=\\'%23cccccc\\' d=\\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z\\'/></svg>'">
      <div>
        <h2 class="app-details-title">${app.title}</h2>
        <p class="app-details-author">${app.author}</p>
      </div>
      <button class="launch-button" id="launchButton" href="${app.url}">Launch</button>
    </div>
    <div class="app-long-description">
      ${renderMarkdown(app.longDescription)}
    </div>
  `;

  document.getElementById('detailsModal').style.display = 'block';

  // Add event listener to launch button
  document.getElementById('launchButton').addEventListener('click', function() {
    // Check if the app has a URL
    if (app.url && app.url.trim() !== '') {
      // Open the URL in a new tab
      window.open(app.url, '_blank');
    } else {
      // If no URL is provided, show an alert
      alert(`No URL available for ${app.title}.`);
    }
  });
}

// Tooltip scroll animation functions
function startTooltipScroll(tooltip, tooltipText, appCard) {
  // Stop any existing animation
  if (activeTooltipAnimation) {
    clearTimeout(activeTooltipAnimation.timeout);
    clearInterval(activeTooltipAnimation.interval);
  }

  // Reset position
  tooltipText.style.transform = 'translateY(0)';

  // Store current card
  currentAnimatedCard = appCard;

  // Use requestAnimationFrame to ensure tooltip is rendered before calculating dimensions
  requestAnimationFrame(() => {
    // Small additional delay to ensure CSS transition completes
    setTimeout(() => {
      // Get dimensions
      const tooltipHeight = tooltip.clientHeight;
      const textHeight = tooltipText.scrollHeight;

      // Calculate if scrolling is needed
      const scrollDistance = textHeight - tooltipHeight;

      if (scrollDistance <= 0) {
        // No scrolling needed, text fits
        return;
      }

      // Animation parameters
      const scrollSpeed = 20; // pixels per second (slower for better readability)
      const scrollDuration = (scrollDistance / scrollSpeed) * 1000; // milliseconds
      const pauseDuration = 1000; // 1 second pause

      let animationState = {
        timeout: null,
        interval: null
      };

      function animateScroll() {
        let startTime = Date.now();
        let startPosition = 0;

        // Scroll animation
        animationState.interval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / scrollDuration, 1);
          const currentPosition = startPosition - (scrollDistance * progress);

          tooltipText.style.transform = `translateY(${currentPosition}px)`;

          if (progress >= 1) {
            clearInterval(animationState.interval);

            // Wait 1 second, then reset and wait 1 second, then start again
            animationState.timeout = setTimeout(() => {
              tooltipText.style.transform = 'translateY(0)';

              animationState.timeout = setTimeout(() => {
                // Check if we're still hovering the same card
                if (currentAnimatedCard === appCard) {
                  animateScroll();
                }
              }, pauseDuration);
            }, pauseDuration);
          }
        }, 50); // Update every 50ms for smooth animation
      }

      // Store animation state
      activeTooltipAnimation = animationState;

      // Start the animation
      animateScroll();
    }, 100); // 100ms delay to ensure tooltip is fully visible
  });
}

function stopTooltipScroll(tooltipText) {
  // Clear any active animations
  if (activeTooltipAnimation) {
    if (activeTooltipAnimation.timeout) {
      clearTimeout(activeTooltipAnimation.timeout);
    }
    if (activeTooltipAnimation.interval) {
      clearInterval(activeTooltipAnimation.interval);
    }
    activeTooltipAnimation = null;
  }

  // Reset position
  tooltipText.style.transform = 'translateY(0)';
  currentAnimatedCard = null;
}
