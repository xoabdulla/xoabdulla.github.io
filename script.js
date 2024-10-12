const API_URL = 'https://learn.reboot01.com/api/graphql-engine/v1/graphql';
const AUTH_URL = 'https://learn.reboot01.com/api/auth/signin';

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('error');

    try {
        const response = await fetch(AUTH_URL, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + btoa(username + ':' + password),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        if (!response.ok) {
            throw new Error('Authentication failed');
        }

        const data = await response.json();
        const token = data;

        if (!token || token.length === 0) {
            throw new Error('Invalid token received');
        }

        localStorage.setItem('token', token);
        window.location.href = 'profile.html';
    } catch (error) {
        console.error('Login error:', error);
        errorElement.textContent = error.message;
    }
}

async function fetchProfile() {
    console.log('Fetching profile...');
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('No token found');
        window.location.href = 'index.html';
        return;
    }

    const query = `
    query {
        user {
            login
            email
            firstName
            lastName
            auditRatio
            totalUp
            totalDown
            transactions(order_by: {createdAt: desc}, where: {type: {_eq: "xp"}, eventId: {_is_null: false}}, limit: 1000) {
                amount
                createdAt
            }
        }
    }
    `;
    

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ query })
        });

        const data = await response.json();
        displayProfile(data.data.user[0]);
    } catch (error) {
        console.error('Error fetching profile:', error);
    }
}

function displayProfile(user) {
    const loginForm = document.getElementById('loginForm');
    const profile = document.getElementById('profile');
    const xpData = processXPData(user.transactions);
    drawXPBarChart(xpData);


    if (loginForm) loginForm.classList.add('hidden');
    if (profile) profile.classList.remove('hidden');

    document.getElementById('welcomeMessage').textContent = `Welcome, ${user.login}!`;
    document.getElementById('fullName').textContent = `Full Name: ${user.firstName} ${user.lastName}`;
    document.getElementById('userEmail').textContent = `Email: ${user.email}`;

    drawAuditRatioGraph(user.auditRatio, user.totalUp, user.totalDown);
}

function drawAuditRatioGraph(auditRatio, totalUp, totalDown) {
    const svg = document.getElementById('projectRatioGraph');
    svg.innerHTML = '';

    const total = totalUp + totalDown;
    const passRatio = totalUp / total;
    const failRatio = totalDown / total;

    const passArc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    passArc.setAttribute('cx', '50');
    passArc.setAttribute('cy', '50');
    passArc.setAttribute('r', '40');
    passArc.setAttribute('fill', 'transparent');
    passArc.setAttribute('stroke', '#1B1A55');
    passArc.setAttribute('stroke-width', '20');
    passArc.setAttribute('stroke-dasharray', `${passRatio * 251.2} 251.2`);
    svg.appendChild(passArc);

    const failArc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    failArc.setAttribute('cx', '50');
    failArc.setAttribute('cy', '50');
    failArc.setAttribute('r', '40');
    failArc.setAttribute('fill', 'transparent');
    failArc.setAttribute('stroke', '#535C91');
    failArc.setAttribute('stroke-width', '20');
    failArc.setAttribute('stroke-dasharray', `${failRatio * 251.2} 251.2`);
    failArc.setAttribute('stroke-dashoffset', `-${passRatio * 251.2}`);
    svg.appendChild(failArc);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '50');
    text.setAttribute('y', '50');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dy', '.3em');
    text.setAttribute('font-size', '15');
    text.setAttribute('fill', '#333');
    text.textContent = `${(auditRatio * 100).toFixed(1)}%`;
    svg.appendChild(text);

    const hoverDetails = document.getElementById('hoverDetails');
    const totalUpMB = (totalUp / 1000000).toFixed(2);
    const totalDownMB = (totalDown / 1000000).toFixed(2);
    hoverDetails.innerHTML = `Done: ${parseFloat(totalUpMB).toFixed(2)} MB<br>Received: ${parseFloat(totalDownMB).toFixed(2)} MB`;
    svg.addEventListener('mouseover', () => hoverDetails.style.display = 'block');
    svg.addEventListener('mouseout', () => hoverDetails.style.display = 'none');
}

function processXPData(transactions) {
    const monthOrder = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
    const monthlyXP = {};
    
    monthOrder.forEach(month => monthlyXP[month] = 0);

    transactions.forEach(t => {
        const date = new Date(t.createdAt);
        const monthName = date.toLocaleString('default', { month: 'short' });
        if (monthOrder.includes(monthName)) {
            monthlyXP[monthName] += t.amount;
        }
    });

    return monthOrder.map(month => ({ month, xp: monthlyXP[month] }));
}

function drawXPBarChart(xpData) {
    const svg = d3.select('#xpBarChart');
    svg.selectAll("*").remove();

    const width = 500;
    const height = 300;
    const margin = { top: 20, right: 20, bottom: 30, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const x = d3.scaleBand()
        .range([0, chartWidth])
        .padding(0.1)
        .domain(xpData.map(d => d.month));

    const y = d3.scaleLinear()
        .range([chartHeight, 0])
        .domain([0, d3.max(xpData, d => d.xp)]);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
        const bars = g.selectAll(".bar")
        .data(xpData)
        .enter().append("g");

    bars.append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.month))
        .attr("y", d => y(d.xp))
        .attr("width", x.bandwidth())
        .attr("height", d => chartHeight - y(d.xp))
        .attr("fill", "#535C91");

    bars.append("text")
        .attr("x", d => x(d.month) + x.bandwidth() / 2)
        .attr("y", d => y(d.xp) + (chartHeight - y(d.xp)) / 2)
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .attr("font-weight", "bold")
        .attr("font-size", "10px")
        .text(d => d.xp);

    g.append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x));

    g.append("g")
        .call(d3.axisLeft(y));

    g.selectAll(".bar")
        .data(xpData)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.month))
        .attr("y", d => y(d.xp))
        .attr("width", x.bandwidth())
        .attr("height", d => chartHeight - y(d.xp))
        .attr("fill", "#4CAF50");

    svg.attr("width", width)
       .attr("height", height);
}

function logout() {
    localStorage.removeItem('token');
    
    const loginForm = document.getElementById('loginForm');
    const profile = document.getElementById('profile');
    const username = document.getElementById('username');
    const password = document.getElementById('password');

    if (loginForm) loginForm.classList.remove('hidden');
    if (profile) profile.classList.add('hidden');
    if (username) username.value = '';
    if (password) password.value = '';

    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('profile.html')) {
        fetchProfile();
    }
});
