// Get variables from global scope (defined in HTML)
const proxyUrl = window.proxyUrl || '';
const API_KEY = window.API_KEY || '';
const NEWS_API_BASE_URL = window.NEWS_API_BASE_URL || '';
const DEFAULT_QUERY_PARAMS = window.DEFAULT_QUERY_PARAMS || {};
const formattedDate = window.formattedDate || '';

// Update status message function
const updateStatus = window.updateStatus || ((message, type) => {
    console.log(`Status: ${message}`);
});

// Initialize function to start the application
async function initialize() {
    if (!proxyUrl || !API_KEY || !NEWS_API_BASE_URL || !formattedDate) {
        updateStatus('Missing required configuration', 'danger');
        return;
    }
    try {
        updateStatus('Fetching news articles...', 'info');
        const articles = await fetchNews();
        if (!articles || articles.length === 0) {
            updateStatus('No articles found', 'warning');
            return;
        }
        await processArticles(articles);
        updateStatus('Articles loaded successfully', 'success');
    } catch (error) {
        console.error('Error initializing:', error);
        updateStatus(`Failed to initialize: ${error.message}`, 'danger');
    }
}

async function fetchNews() {
    try {
        console.log('=== Starting fetchNews ===');
        console.log('Configuration:', {
            NEWS_API_BASE_URL,
            API_KEY: API_KEY ? '***' : 'undefined',
            formattedDate,
            proxyUrl
        });

        // Create query parameters
        const queryParams = new URLSearchParams({
            q: 'bitcoin',
            from: formattedDate,
            sortBy: 'publishedAt',
            language: 'en',
            pageSize: 100,
            apiKey: API_KEY
        });
        console.log('Query parameters:', queryParams.toString());

        // Try multiple approaches
        const approaches = [
            // Direct request (should work since API key is valid)
            { name: 'direct', url: `${NEWS_API_BASE_URL}?${queryParams}` },
            // Try with local proxy
            { name: 'local-proxy', url: `${proxyUrl}${NEWS_API_BASE_URL}?${queryParams}` },
            // Try with alternative CORS proxy
            { name: 'alternative-proxy', url: `https://api.allorigins.win/get?url=${encodeURIComponent(`${NEWS_API_BASE_URL}?${queryParams}`)}` }
        ];

        console.log('Available approaches:', approaches.map(a => a.name));

        let successfulResponse;
        for (const approach of approaches) {
            console.log(`\n=== Attempting approach: ${approach.name} ===`);
            console.log('Request URL:', approach.url);
            
            try {
                console.log('Making request...');
                const response = await fetch(approach.url);
                
                console.log('Response status:', response.status);
                
                if (response.ok) {
                    console.log(`${approach.name} approach succeeded!`);
                    successfulResponse = response;
                    break;
                } else {
                    console.log(`${approach.name} failed with status: ${response.status}`);
                    const errorText = await response.text();
                    console.error(`${approach.name} error response:`, errorText.substring(0, 200));
                }
            } catch (error) {
                console.error(`${approach.name} failed with error:`, error);
            }
        }

        if (!successfulResponse) {
            throw new Error('All approaches failed to fetch data');
        }

        console.log('Got successful response, parsing...');
        const responseText = await successfulResponse.text();
        console.log('Response text (first 200 chars):', responseText.substring(0, 200));

        // Store the successful approach
        const successfulApproach = approaches.find(a => a.name === 'local-proxy');

        try {
            // For alternative proxy, we need to parse the proxy response
            let data;
            if (successfulApproach?.name === 'alternative-proxy') {
                console.log('Parsing proxy response...');
                const proxyResponse = JSON.parse(responseText);
                data = JSON.parse(proxyResponse.contents);
            } else {
                console.log('Parsing direct response...');
                data = JSON.parse(responseText);
            }

            console.log('Successfully parsed data:', {
                status: data.status,
                articleCount: data.articles?.length || 0
            });
            
            if (data.status !== 'ok') {
                throw new Error(`News API error: ${data.message || 'Unknown error'}`);
            }

            return data.articles || [];
        } catch (parseError) {
            console.error('Error parsing response:', parseError);
            console.error('Response text:', responseText);
            throw new Error(`Invalid JSON response: ${parseError.message}. Raw response: ${responseText.substring(0, 200)}`);
        }
    } catch (error) {
        console.error('=== Error in fetchNews ===');
        console.error('Error details:', error);
        updateStatus(`Error loading news: ${error.message}`, 'danger');
        throw error;
    }
}

// Simple sentiment analysis using keywords
function analyzeSentiment(text) {
    const bullishKeywords = ['rise', 'gain', 'up', 'increase', 'bull', 'positive', 'optimistic', 'growth', 'strong', 'upward'];
    const bearishKeywords = ['fall', 'drop', 'down', 'decrease', 'bear', 'negative', 'pessimistic', 'weak', 'downward', 'loss'];
    
    const textLower = text.toLowerCase();
    
    // Count keyword occurrences
    let bullishScore = 0;
    let bearishScore = 0;
    
    bullishKeywords.forEach(keyword => {
        bullishScore += (textLower.match(new RegExp(keyword, 'g')) || []).length;
    });
    
    bearishKeywords.forEach(keyword => {
        bearishScore += (textLower.match(new RegExp(keyword, 'g')) || []).length;
    });
    
    return {
        score: bullishScore - bearishScore,
        bullishScore,
        bearishScore
    };
}

function processArticles(articles) {
    if (!articles || !Array.isArray(articles)) {
        console.error('Invalid articles data:', articles);
        updateStatus('Invalid news articles data received', 'danger');
        return;
    }

    let bullishContent = '';
    let bearishContent = '';
    const newsList = document.getElementById('newsArticles');
    
    // Clear loading message
    newsList.innerHTML = '';

    for (const article of articles) {
        try {
            // Create news item
            const newsItem = document.createElement('div');
            newsItem.className = 'card mb-3';
            
            // Handle undefined values safely
            const title = article.title || 'No title available';
            const description = article.description || 'No description available';
            const url = article.url || '#';
            
            newsItem.innerHTML = `
                <div class="card-body">
                    <h5 class="card-title">${title}</h5>
                    <p class="card-text">${description}</p>
                    <a href="${url}" class="btn btn-primary" target="_blank">Read More</a>
                </div>
            `;
            newsList.appendChild(newsItem);

            // Analyze sentiment
            const sentiment = analyzeSentiment(description || title);
            
            // Add to appropriate summary
            if (sentiment.score > 0) {
                bullishContent += `<p><strong>${title}</strong>: ${description}</p>`;
            } else if (sentiment.score < 0) {
                bearishContent += `<p><strong>${title}</strong>: ${description}</p>`;
            }
        } catch (error) {
            console.error('Error processing article:', error);
            continue;
        }
    }

    // Update summaries
    document.getElementById('bullishSummary').innerHTML = `
        <h4>Bullish Articles (${bullishContent.split('<p>').length - 1} articles)</h4>
        ${bullishContent}
    `;
    document.getElementById('bearishSummary').innerHTML = `
        <h4>Bearish Articles (${bearishContent.split('<p>').length - 1} articles)</h4>
        ${bearishContent}
    `;
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize market trend chart
        const ctx = document.getElementById('marketTrendChart').getContext('2d');
        const marketTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['1D', '2D', '3D', '4D', '5D', '6D', '7D'],
                datasets: [{
                    label: 'Bitcoin Price (USD)',
                    data: [60000, 62000, 63000, 64000, 65000, 66000, 67000],
                    borderColor: 'rgb(0, 255, 0)',
                    backgroundColor: 'rgba(0, 255, 0, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#fff'
                        }
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            color: '#fff',
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#fff'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            }
        });

        // Initialize news app
        await initialize();
    } catch (error) {
        console.error('Error in DOMContentLoaded:', error);
        updateStatus(`Error loading news: ${error.message}`, 'danger');
        document.getElementById('bullishSummary').innerHTML = 'Error loading data. Please try again later.';
        document.getElementById('bearishSummary').innerHTML = 'Error loading data. Please try again later.';
    }
});
