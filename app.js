/**
 * Sistema de Abastecimento de Lojas - San Marino Fiat
 * Gravataí • Zona Sul • Viamão • Matriz
 */

// Application State
const state = {
    parts: [],
    targets: {
        gravatai: 2,
        zonasul: 2,
        viamao: 2
    },
    pickedItems: new Set(),
    filters: {
        search: '',
        status: 'precisa_enviar',
        family: '',
        car: ''
    },
    sort: {
        column: 'total_enviar',
        direction: 'desc'
    },
    fileInfo: {
        name: 'estoque 19-10.xlsx',
        date: '19/10/2026 17:10:37',
        rows: 5702
    }
};

// Available Vehicle Models for Filter
const ALL_CAR_MODELS = [
    "500e", "ARGO 1.0", "ARGO 1.3 AT", "ARGO 1.3 MT", "ARGO 1.8",
    "CRONOS 1.0 MY27", "CRONOS 1.0 até MY26", "CRONOS 1.3 MY27 AT", "CRONOS 1.3 MY27 MT",
    "CRONOS 1.3 até MY26", "CRONOS 1.8", "DOBLO 1.8", "DUCATO", "DUCATO X250",
    "DUCATO X250 2.2D MY26", "FASTBACK 1.0T", "FASTBACK ABARTH 1.3T", "FIORINO 1.3",
    "FIORINO 1.4 (2021/2022 para cima)", "GRAND SIENA 1.0", "GRAND SIENA 1.4",
    "MOBI 1.0 FIRE", "MOBI 1.0 MY27", "MOBI FIREFLY", "NOVA STRADA 1.0T",
    "NOVA STRADA 1.3 AT", "NOVA STRADA 1.3 MT", "NOVA STRADA 1.4", "PALIO WEEKEND 1.4",
    "PALIO WEEKEND 1.8", "PULSE 1.0T AT", "PULSE 1.0T MT", "PULSE 1.3 AT",
    "PULSE 1.3 MT", "PULSE ABARTH 1.3T", "SCUDO 1.5 (Antiga)", "SCUDO 2.2 (Nova)",
    "TITANO 2.2D AT (Antiga/9VC)", "TITANO 2.2D MT (Antiga/9VC)", "TITANO DS 2.2D AT MY26/Nova/8AP",
    "TITANO DS 2.2D AT MY27/Nova/8AP", "TITANO DS 2.2D MT MY26/Nova/8AP", "TITANO DS 2.2D MT MY27/Nova/8AP",
    "TORO 1.3T MHEV", "TORO 1.3T MY25", "TORO 1.3T MY26", "TORO 1.3T MY27",
    "TORO 1.8", "TORO 2.0", "TORO 2.2TD MY26", "TORO 2.2TD MY27", "TORO 2.4",
    "UNO 1.0 FIRE", "UNO 1.0 FIREFLY", "UNO 1.3 FIREFLY", "e-SCUDO"
];

// Normalize strings (accents, uppercase, trim)
function cleanCode(code) {
    if (!code) return '';
    return code.toString().trim().toUpperCase().replace(/_F$/, '');
}

function normalizeStr(str) {
    if (!str) return '';
    return str.toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function identifyStore(str) {
    if (!str) return null;
    const s = normalizeStr(str);
    if (s.includes('matriz')) return 'matriz';
    if (s.includes('gravatai')) return 'gravatai';
    if (s.includes('zona sul') || s.includes('zonasul')) return 'zonasul';
    if (s.includes('viamao')) return 'viamao';
    return null;
}

// Calculate Replenishment Metrics for an Item
function calculateItemReplenishment(item) {
    const metaG = state.targets.gravatai;
    const metaZS = state.targets.zonasul;
    const metaV = state.targets.viamao;

    const estMatriz = parseFloat(item.estoque_matriz) || 0;
    const estGrav = parseFloat(item.estoque_gravatai) || 0;
    const estZS = parseFloat(item.estoque_zonasul) || 0;
    const estViam = parseFloat(item.estoque_viamao) || 0;

    const necG = Math.max(0, metaG - estGrav);
    const necZS = Math.max(0, metaZS - estZS);
    const necV = Math.max(0, metaV - estViam);
    const totalEnviar = necG + necZS + necV;

    const saldoMatriz = estMatriz - totalEnviar;

    let status = 'balanced'; // Filiais abastecidas
    if (totalEnviar > 0) {
        if (estMatriz >= totalEnviar) {
            status = 'ok'; // Atende 100%
        } else if (estMatriz > 0) {
            status = 'partial'; // Atende Parcialmente
        } else {
            status = 'zero'; // Zerada na Matriz
        }
    }

    // Picking Allocation from Matriz
    let sepG = 0, sepZS = 0, sepV = 0;
    if (estMatriz >= totalEnviar) {
        sepG = necG;
        sepZS = necZS;
        sepV = necV;
    } else if (estMatriz > 0) {
        let disp = Math.floor(estMatriz);
        while (disp > 0 && (sepG < necG || sepZS < necZS || sepV < necV)) {
            if (sepG < necG && disp > 0) { sepG++; disp--; }
            if (sepZS < necZS && disp > 0) { sepZS++; disp--; }
            if (sepV < necV && disp > 0) { sepV++; disp--; }
        }
    }
    const totalRetirar = sepG + sepZS + sepV;
    const saldoAposRetirar = Math.max(0, estMatriz - totalRetirar);

    return {
        ...item,
        nec_gravatai: necG,
        nec_zonasul: necZS,
        nec_viamao: necV,
        total_enviar: totalEnviar,
        saldo_matriz: saldoMatriz,
        status: status,
        sep_gravatai: sepG,
        sep_zonasul: sepZS,
        sep_viamao: sepV,
        total_retirar: totalRetirar,
        saldo_apos_retirar: saldoAposRetirar
    };
}

// Get Processed Items with Calculations
function getProcessedItems() {
    return state.parts.map(calculateItemReplenishment);
}

// Toast Notifications
function showToast(message, icon = 'ℹ️') {
    const box = document.getElementById('toastBox');
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    box.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

// Copy Code to Clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(`Código <strong>${text}</strong> copiado para a área de transferência!`, '📋');
    }).catch(() => {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast(`Código <strong>${text}</strong> copiado!`, '📋');
    });
}

// Highlight matched search query
function highlightText(text, query) {
    if (!query || !text) return text || '';
    const normText = normalizeStr(text);
    const normQuery = normalizeStr(query);
    const idx = normText.indexOf(normQuery);
    if (idx === -1) return text;
    const originalPart = text.substr(idx, query.length);
    return text.substring(0, idx) + `<mark style="background: rgba(245, 158, 11, 0.35); color: inherit; padding: 0 2px; border-radius: 2px;">${originalPart}</mark>` + text.substring(idx + query.length);
}

// Render KPI Cards
function updateKPIs(processedItems) {
    let matrizTotalStock = 0;
    let totalEnviar = 0;
    let atende100 = 0;
    let atendeParcial = 0;
    let matrizZeradas = 0;

    processedItems.forEach(item => {
        matrizTotalStock += (parseFloat(item.estoque_matriz) || 0);
        totalEnviar += item.total_enviar;

        if (item.total_enviar > 0) {
            if (item.status === 'ok') atende100++;
            else if (item.status === 'partial') atendeParcial++;
            else if (item.status === 'zero') matrizZeradas++;
        }
    });

    document.getElementById('kpiMatrizTotal').textContent = Math.round(matrizTotalStock).toLocaleString('pt-BR');
    document.getElementById('kpiTotalEnviar').textContent = Math.round(totalEnviar).toLocaleString('pt-BR');
    document.getElementById('kpiAtende100').textContent = atende100;
    document.getElementById('kpiAtendeParcial').textContent = atendeParcial;
    document.getElementById('kpiMatrizZeradas').textContent = matrizZeradas;

    document.getElementById('tabBadgeGeral').textContent = processedItems.length;
    
    // Items that have stock in Matriz and are needed by branches
    const pickingItems = processedItems.filter(it => it.total_retirar > 0);
    document.getElementById('tabBadgeRomaneio').textContent = `${pickingItems.length} itens`;
    document.getElementById('tabBadgeCompras').textContent = `${matrizZeradas} itens`;
}

// Render Master Table (Tab 1)
function renderTableGeral() {
    const tbody = document.getElementById('tbodyGeral');
    const items = getProcessedItems();
    const query = normalizeStr(state.filters.search);

    // Filter
    let filtered = items.filter(item => {
        // Status filter
        if (state.filters.status === 'precisa_enviar' && item.total_enviar <= 0) return false;
        if (state.filters.status === 'matriz_ok' && item.status !== 'ok') return false;
        if (state.filters.status === 'matriz_parcial' && item.status !== 'partial') return false;
        if (state.filters.status === 'matriz_zero' && item.status !== 'zero') return false;
        if (state.filters.status === 'lojas_abastecidas' && item.total_enviar > 0) return false;

        // Vehicle Family chip filter
        if (state.filters.family) {
            const hasFam = (item.carros_list || []).some(c => c.toUpperCase().includes(state.filters.family));
            if (!hasFam) return false;
        }

        // Specific Car Model select filter
        if (state.filters.car) {
            const hasCar = (item.carros_list || []).includes(state.filters.car);
            if (!hasCar) return false;
        }

        // Search text filter
        if (query) {
            const codeMatch = normalizeStr(item.codigo).includes(query);
            const nameMatch = normalizeStr(item.nome).includes(query);
            const carMatch = normalizeStr(item.carros).includes(query);
            if (!codeMatch && !nameMatch && !carMatch) return false;
        }

        return true;
    });

    // Sort
    const col = state.sort.column;
    const dir = state.sort.direction === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
        let valA = a[col];
        let valB = b[col];

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="13" style="text-align: center; padding: 40px; color: var(--text-muted); font-style: italic;">
                    Nenhuma peça encontrada com os filtros selecionados.
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach((item, index) => {
        const tr = document.createElement('tr');

        // Status badge
        let statusBadgeHtml = '';
        if (item.total_enviar === 0) {
            statusBadgeHtml = `<span class="matriz-status-badge status-balanced">Lojas OK</span>`;
        } else if (item.status === 'ok') {
            statusBadgeHtml = `<span class="matriz-status-badge status-ok">✅ Atende 100%</span>`;
        } else if (item.status === 'partial') {
            statusBadgeHtml = `<span class="matriz-status-badge status-partial">⚠️ Parcial (${item.estoque_matriz}/${item.total_enviar})</span>`;
        } else {
            statusBadgeHtml = `<span class="matriz-status-badge status-zero">❌ Falta na Matriz</span>`;
        }

        // Car badges summary
        const carList = item.carros_list || [];
        let carsPreview = '';
        if (carList.length > 0) {
            const firstTwo = carList.slice(0, 2).map(c => `<span style="font-size: 0.72rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-color); padding: 1px 5px; border-radius: 3px; white-space: nowrap;">${c}</span>`).join(' ');
            const extraCount = carList.length > 2 ? `<span style="font-size: 0.7rem; color: var(--text-muted);" title="${carList.join(', ')}">+${carList.length - 2}</span>` : '';
            carsPreview = `<div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">${firstTwo} ${extraCount}</div>`;
        }

        // Need badges for branches
        const gNeedBadge = item.nec_gravatai > 0 
            ? `<span class="transfer-qty need-high">+${item.nec_gravatai}</span>` 
            : `<span class="transfer-qty need-ok">-</span>`;
        
        const zsNeedBadge = item.nec_zonasul > 0 
            ? `<span class="transfer-qty need-high">+${item.nec_zonasul}</span>` 
            : `<span class="transfer-qty need-ok">-</span>`;
        
        const vNeedBadge = item.nec_viamao > 0 
            ? `<span class="transfer-qty need-high">+${item.nec_viamao}</span>` 
            : `<span class="transfer-qty need-ok">-</span>`;

        tr.innerHTML = `
            <td style="text-align: center; color: var(--text-muted); font-size: 0.75rem;">${index + 1}</td>
            <td>
                <div class="cell-code">
                    <span>${highlightText(item.codigo, state.filters.search)}</span>
                    <button class="btn-copy-code" title="Copiar código" onclick="copyToClipboard('${item.codigo}')">
                        📋
                    </button>
                </div>
            </td>
            <td>
                <div class="cell-desc" title="${item.nome}">${highlightText(item.nome, state.filters.search)}</div>
            </td>
            <td>${carsPreview}</td>
            <td style="text-align: center;">
                ${item.loc_matriz ? `<span class="loc-badge">${item.loc_matriz}</span>` : '<span style="color: var(--text-muted);">-</span>'}
            </td>
            <td style="text-align: center; font-weight: 700; font-size: 0.9rem;">
                ${item.estoque_matriz > 0 ? item.estoque_matriz : '<span style="color: var(--fiat-red);">0</span>'}
            </td>
            <td class="stock-store-cell">
                <div class="stock-pair">
                    <span class="current-stock">${item.estoque_gravatai}</span>
                    <span style="color: var(--text-muted);">|</span>
                    ${gNeedBadge}
                </div>
            </td>
            <td class="stock-store-cell">
                <div class="stock-pair">
                    <span class="current-stock">${item.estoque_zonasul}</span>
                    <span style="color: var(--text-muted);">|</span>
                    ${zsNeedBadge}
                </div>
            </td>
            <td class="stock-store-cell">
                <div class="stock-pair">
                    <span class="current-stock">${item.estoque_viamao}</span>
                    <span style="color: var(--text-muted);">|</span>
                    ${vNeedBadge}
                </div>
            </td>
            <td class="total-send-cell">
                ${item.total_enviar > 0 ? `+${item.total_enviar}` : '<span style="color: var(--text-muted); font-weight: normal;">0</span>'}
            </td>
            <td style="text-align: center; font-weight: 600; color: ${item.saldo_matriz < 0 ? 'var(--fiat-red)' : 'var(--text-secondary)'};">
                ${item.saldo_matriz}
            </td>
            <td style="text-align: center;">
                ${statusBadgeHtml}
            </td>
            <td style="text-align: center;">
                <button class="btn-icon btn-view-detail" data-code="${item.codigo}" title="Ver detalhes da peça">
                    👁️
                </button>
            </td>
        `;

        tbody.appendChild(tr);
    });

    // Attach click events to detail buttons
    tbody.querySelectorAll('.btn-view-detail').forEach(btn => {
        btn.addEventListener('click', () => {
            const code = btn.getAttribute('data-code');
            openPartModal(code);
        });
    });
}

// Render Picking List (Tab 2)
function renderTableRomaneio() {
    const tbody = document.getElementById('tbodyRomaneio');
    const items = getProcessedItems();

    // Only items that can actually be picked from Matriz (total_retirar > 0)
    let pickingItems = items.filter(it => it.total_retirar > 0);

    // Sort primarily by Matriz Location (loc_matriz) for efficient warehouse picking!
    pickingItems.sort((a, b) => {
        const locA = (a.loc_matriz || 'ZZZZ').toUpperCase();
        const locB = (b.loc_matriz || 'ZZZZ').toUpperCase();
        return locA.localeCompare(locB);
    });

    tbody.innerHTML = '';

    let pickedCount = 0;
    pickingItems.forEach(item => {
        if (state.pickedItems.has(item.codigo)) pickedCount++;
    });

    const percent = pickingItems.length > 0 ? Math.round((pickedCount / pickingItems.length) * 100) : 0;
    document.getElementById('pickingProgressText').textContent = `${pickedCount} de ${pickingItems.length} itens separados (${percent}%)`;
    document.getElementById('pickingProgressBar').style.width = `${percent}%`;

    if (pickingItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-muted); font-style: italic;">
                    Nenhum item com estoque na Matriz necessita ser separado no momento.
                </td>
            </tr>
        `;
        return;
    }

    pickingItems.forEach(item => {
        const tr = document.createElement('tr');
        const isPicked = state.pickedItems.has(item.codigo);
        if (isPicked) tr.classList.add('row-picked');

        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="checkbox-custom pick-checkbox" data-code="${item.codigo}" ${isPicked ? 'checked' : ''}>
            </td>
            <td style="text-align: center;">
                <span class="loc-badge" style="font-size: 0.88rem; padding: 4px 10px;">${item.loc_matriz || 'S/L'}</span>
            </td>
            <td>
                <span class="cell-code">${item.codigo}</span>
            </td>
            <td>
                <div class="cell-desc" title="${item.nome}">${item.nome}</div>
            </td>
            <td style="text-align: center; font-size: 1.05rem; font-weight: 800; color: #60a5fa; background: rgba(37, 99, 235, 0.08);">
                ${item.total_retirar}
            </td>
            <td style="text-align: center; font-weight: 700; color: ${item.sep_gravatai > 0 ? '#34d399' : 'var(--text-muted)'};">
                ${item.sep_gravatai > 0 ? `${item.sep_gravatai} un` : '-'}
            </td>
            <td style="text-align: center; font-weight: 700; color: ${item.sep_zonasul > 0 ? '#34d399' : 'var(--text-muted)'};">
                ${item.sep_zonasul > 0 ? `${item.sep_zonasul} un` : '-'}
            </td>
            <td style="text-align: center; font-weight: 700; color: ${item.sep_viamao > 0 ? '#34d399' : 'var(--text-muted)'};">
                ${item.sep_viamao > 0 ? `${item.sep_viamao} un` : '-'}
            </td>
            <td style="text-align: center; color: var(--text-secondary); font-size: 0.82rem;">
                ${item.saldo_apos_retirar} un
            </td>
        `;

        tbody.appendChild(tr);
    });

    // Checkbox toggle event
    tbody.querySelectorAll('.pick-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const code = cb.getAttribute('data-code');
            if (cb.checked) {
                state.pickedItems.add(code);
            } else {
                state.pickedItems.delete(code);
            }
            renderTableRomaneio();
        });
    });
}

// Render Branch Manifest Cards (Tab 3)
function renderTabLojas() {
    const items = getProcessedItems();

    const gravItems = items.filter(it => it.sep_gravatai > 0);
    const zsItems = items.filter(it => it.sep_zonasul > 0);
    const viamItems = items.filter(it => it.sep_viamao > 0);

    const gravTotalUnits = gravItems.reduce((acc, it) => acc + it.sep_gravatai, 0);
    const zsTotalUnits = zsItems.reduce((acc, it) => acc + it.sep_zonasul, 0);
    const viamTotalUnits = viamItems.reduce((acc, it) => acc + it.sep_viamao, 0);

    const gravZerados = items.filter(it => it.estoque_gravatai === 0).length;
    const zsZerados = items.filter(it => it.estoque_zonasul === 0).length;
    const viamZerados = items.filter(it => it.estoque_viamao === 0).length;

    // Update Stats
    document.getElementById('statGravataiReceber').textContent = gravTotalUnits;
    document.getElementById('statGravataiZerados').textContent = gravZerados;
    document.getElementById('footerGravataiTotal').textContent = `Total de ${gravTotalUnits} unidades em ${gravItems.length} itens`;

    document.getElementById('statZonaSulReceber').textContent = zsTotalUnits;
    document.getElementById('statZonaSulZerados').textContent = zsZerados;
    document.getElementById('footerZonaSulTotal').textContent = `Total de ${zsTotalUnits} unidades em ${zsItems.length} itens`;

    document.getElementById('statViamaoReceber').textContent = viamTotalUnits;
    document.getElementById('statViamaoZerados').textContent = viamZerados;
    document.getElementById('footerViamaoTotal').textContent = `Total de ${viamTotalUnits} unidades em ${viamItems.length} itens`;

    // Render Lists
    function populateList(containerId, list, qtyField) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        if (list.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.8rem;">Nenhuma peça para envio</div>';
            return;
        }
        list.forEach(item => {
            const div = document.createElement('div');
            div.className = 'branch-item-row';
            div.innerHTML = `
                <div>
                    <span style="font-family: monospace; font-weight: 700;">${item.codigo}</span> - 
                    <span>${item.nome}</span>
                    <span style="font-size: 0.7rem; color: var(--text-muted); margin-left: 4px;">(${item.loc_matriz || 'S/L'})</span>
                </div>
                <div style="font-weight: 800; color: #34d399; font-size: 0.88rem;">
                    ${item[qtyField]} un
                </div>
            `;
            container.appendChild(div);
        });
    }

    populateList('listGravataiItems', gravItems, 'sep_gravatai');
    populateList('listZonaSulItems', zsItems, 'sep_zonasul');
    populateList('listViamaoItems', viamItems, 'sep_viamao');
}

// Render Purchase Recommendations (Tab 4)
function renderTableCompras() {
    const tbody = document.getElementById('tbodyCompras');
    const items = getProcessedItems();

    // Items with zero or partial stock in Matriz where stores need replenishment
    const deficitItems = items.filter(it => it.total_enviar > 0 && it.estoque_matriz < it.total_enviar);

    // Sort by largest deficit
    deficitItems.sort((a, b) => {
        const defA = (a.total_enviar - a.estoque_matriz);
        const defB = (b.total_enviar - b.estoque_matriz);
        return defB - defA;
    });

    tbody.innerHTML = '';

    if (deficitItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-muted); font-style: italic;">
                    Excelente! Não há peças em falta na Matriz para suprir as metas atuais das lojas.
                </td>
            </tr>
        `;
        return;
    }

    deficitItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        const deficitTotal = Math.max(0, item.total_enviar - item.estoque_matriz);

        const precoCustoNum = parseFloat(item.preco_custo) || 0;
        const precoCustoStr = precoCustoNum > 0 ? `R$ ${precoCustoNum.toFixed(2).replace('.', ',')}` : '-';

        tr.innerHTML = `
            <td style="text-align: center; color: var(--text-muted); font-size: 0.75rem;">${index + 1}</td>
            <td>
                <span class="cell-code">${item.codigo}</span>
            </td>
            <td>
                <div class="cell-desc" title="${item.nome}">${item.nome}</div>
            </td>
            <td style="text-align: center; font-weight: 700; color: ${item.estoque_matriz === 0 ? 'var(--fiat-red)' : 'var(--warning)'};">
                ${item.estoque_matriz}
            </td>
            <td style="text-align: center; color: ${item.nec_gravatai > 0 ? '#f87171' : 'var(--text-muted)'}; font-weight: 600;">
                ${item.nec_gravatai > 0 ? `${item.nec_gravatai} un` : '-'}
            </td>
            <td style="text-align: center; color: ${item.nec_zonasul > 0 ? '#f87171' : 'var(--text-muted)'}; font-weight: 600;">
                ${item.nec_zonasul > 0 ? `${item.nec_zonasul} un` : '-'}
            </td>
            <td style="text-align: center; color: ${item.nec_viamao > 0 ? '#f87171' : 'var(--text-muted)'}; font-weight: 600;">
                ${item.nec_viamao > 0 ? `${item.nec_viamao} un` : '-'}
            </td>
            <td style="text-align: center; font-size: 1.05rem; font-weight: 800; color: #ef4444; background: rgba(239, 68, 68, 0.08);">
                +${deficitTotal} un
            </td>
            <td style="text-align: right; font-family: monospace;">
                ${precoCustoStr}
            </td>
        `;

        tbody.appendChild(tr);
    });
}

// Refresh all UI views
function refreshAllViews() {
    const items = getProcessedItems();
    updateKPIs(items);
    renderTableGeral();
    renderTableRomaneio();
    renderTabLojas();
    renderTableCompras();
}

// Open Part Details Modal
function openPartModal(code) {
    const items = getProcessedItems();
    const item = items.find(it => it.codigo === code);
    if (!item) return;

    document.getElementById('modalPartCode').textContent = item.codigo;
    document.getElementById('modalPartDesc').textContent = item.nome;

    const estM = item.estoque_matriz;
    const estG = item.estoque_gravatai;
    const estZS = item.estoque_zonasul;
    const estV = item.estoque_viamao;
    const maxVal = Math.max(estM, estG, estZS, estV, 10);

    document.getElementById('modalStockMatriz').textContent = `${estM} un (Locação: ${item.loc_matriz || 'Não informada'})`;
    document.getElementById('modalStockGravatai').textContent = `${estG} un`;
    document.getElementById('modalStockZonaSul').textContent = `${estZS} un`;
    document.getElementById('modalStockViamao').textContent = `${estV} un`;

    document.getElementById('barFillMatriz').style.width = `${Math.min(100, Math.round((estM / maxVal) * 100))}%`;
    document.getElementById('barFillGravatai').style.width = `${Math.min(100, Math.round((estG / maxVal) * 100))}%`;
    document.getElementById('barFillZonaSul').style.width = `${Math.min(100, Math.round((estZS / maxVal) * 100))}%`;
    document.getElementById('barFillViamao').style.width = `${Math.min(100, Math.round((estV / maxVal) * 100))}%`;

    const custoNum = parseFloat(item.preco_custo) || 0;
    const vendaNum = parseFloat(item.preco_venda) || 0;
    document.getElementById('modalPrecoCusto').textContent = custoNum > 0 ? `R$ ${custoNum.toFixed(2).replace('.', ',')}` : 'Sob consulta';
    document.getElementById('modalPrecoVenda').textContent = vendaNum > 0 ? `R$ ${vendaNum.toFixed(2).replace('.', ',')}` : 'Sob consulta';
    document.getElementById('modalNcm').textContent = `${item.ncm || '73269090'} • ${item.fornecedor || 'Fiat'}`;

    const carsListContainer = document.getElementById('modalCarsList');
    carsListContainer.innerHTML = '';
    (item.carros_list || []).forEach(car => {
        const span = document.createElement('span');
        span.className = 'modal-car-tag';
        span.textContent = car;
        carsListContainer.appendChild(span);
    });

    document.getElementById('partDetailModal').classList.add('active');
}

// Process Uploaded Spreadsheet File (.xlsx, .xls, .csv)
function handleFileUpload(file) {
    if (!file) return;

    showToast(`Lendo planilha: ${file.name}...`, '⏳');
    document.getElementById('uploadFileName').textContent = file.name;
    document.getElementById('uploadFileStatus').textContent = 'Processando dados de estoque...';

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            // Detect Header Row
            let headerIdx = -1;
            for (let i = 0; i < Math.min(15, rows.length); i++) {
                const r = rows[i] || [];
                if (r.some(cell => typeof cell === 'string' && /c[oó]d.*item|c[oó]digo|part.*number/i.test(cell))) {
                    headerIdx = i;
                    break;
                }
            }

            if (headerIdx === -1) {
                showToast('Cabeçalho não encontrado na planilha!', '❌');
                document.getElementById('uploadFileStatus').textContent = 'Erro ao identificar colunas da planilha';
                return;
            }

            const headers = rows[headerIdx];
            const colCode = headers.findIndex(h => /c[oó]d.*item|c[oó]digo|part.*number/i.test(h));
            const colStore = headers.findIndex(h => /nome.*empresa|empresa|filial|loja/i.test(h));
            const colStock = headers.findIndex(h => /^estoque$|^saldo$/i.test(h));
            const colRes = headers.findIndex(h => /^res\.?$|^reserva$/i.test(h));
            const colLoc = headers.findIndex(h => /loca[cç][aã]o|endere[cç]o/i.test(h));
            const colCusto = headers.findIndex(h => /pre[cç]o.*custo/i.test(h));
            const colVenda = headers.findIndex(h => /pre[cç]o.*venda.*empresa/i.test(h));
            const colGiro = headers.findIndex(h => /^giro$/i.test(h));
            const colNcm = headers.findIndex(h => /^ncm$/i.test(h));

            // Map data by normalized code
            const excelMap = {};
            for (let i = headerIdx + 1; i < rows.length; i++) {
                const r = rows[i];
                if (!r || !r[colCode]) continue;

                const code = cleanCode(r[colCode]);
                const store = identifyStore(r[colStore]);
                if (!code || !store) continue;

                if (!excelMap[code]) excelMap[code] = {};
                const stock = parseFloat(r[colStock]) || 0;
                const res = parseFloat(r[colRes]) || 0;
                const loc = (r[colLoc] || '').toString().trim();
                const custo = (r[colCusto] || '').toString().trim();
                const venda = (r[colVenda] || '').toString().trim();
                const giro = (r[colGiro] || '').toString().trim();
                const ncm = (r[colNcm] || '').toString().trim();

                excelMap[code][store] = { stock, res, loc, custo, venda, giro, ncm };
            }

            // Update state.parts with newly parsed stocks
            let matchedCount = 0;
            state.parts = state.parts.map(p => {
                const c = cleanCode(p.codigo);
                const storeData = excelMap[c];

                if (storeData) {
                    matchedCount++;
                    const mat = storeData.matriz || {};
                    const grav = storeData.gravatai || {};
                    const zs = storeData.zonasul || {};
                    const viam = storeData.viamao || {};

                    return {
                        ...p,
                        estoque_matriz: mat.stock || 0,
                        loc_matriz: mat.loc || p.loc_matriz || '',
                        estoque_gravatai: grav.stock || 0,
                        estoque_zonasul: zs.stock || 0,
                        estoque_viamao: viam.stock || 0,
                        preco_custo: mat.custo || p.preco_custo,
                        preco_venda: mat.venda || p.preco_venda,
                        giro: mat.giro || p.giro,
                        ncm: mat.ncm || p.ncm
                    };
                } else {
                    // Item not found in the spreadsheet -> stock is 0 across all stores
                    return {
                        ...p,
                        estoque_matriz: 0,
                        estoque_gravatai: 0,
                        estoque_zonasul: 0,
                        estoque_viamao: 0
                    };
                }
            });

            // Update File Meta
            const now = new Date();
            const dateStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');
            document.getElementById('badgeDataEstoque').innerHTML = `<span>Estoque: <strong>${now.toLocaleDateString('pt-BR')}</strong></span>`;
            document.getElementById('uploadFileStatus').textContent = `Carregado: ${rows.length.toLocaleString('pt-BR')} linhas lidas (${matchedCount} peças monitoradas atualizadas)`;
            
            showToast(`Estoque atualizado! ${matchedCount} peças sincronizadas.`, '✅');
            refreshAllViews();

        } catch (err) {
            console.error('Erro ao ler planilha:', err);
            showToast('Erro ao processar arquivo Excel!', '❌');
            document.getElementById('uploadFileStatus').textContent = 'Erro ao processar o arquivo';
        }
    };
    reader.readAsArrayBuffer(file);
}

// Export Master Table to Excel
function exportarTabelaGeral() {
    const items = getProcessedItems();
    const rows = [
        [
            'Código', 'Descrição da Peça', 'Locação Matriz', 'Estoque Matriz',
            'Estoque Gravataí', 'Precisa Gravataí',
            'Estoque Zona Sul', 'Precisa Zona Sul',
            'Estoque Viamão', 'Precisa Viamão',
            'Total a Enviar', 'Saldo Restante Matriz', 'Status Matriz',
            'Carros Aplicáveis'
        ]
    ];

    items.forEach(it => {
        rows.push([
            it.codigo,
            it.nome,
            it.loc_matriz || '',
            it.estoque_matriz,
            it.estoque_gravatai,
            it.nec_gravatai,
            it.estoque_zonasul,
            it.nec_zonasul,
            it.estoque_viamao,
            it.nec_viamao,
            it.total_enviar,
            it.saldo_matriz,
            it.status === 'ok' ? 'Atende 100%' : (it.status === 'partial' ? 'Parcial' : (it.status === 'zero' ? 'Falta na Matriz' : 'Lojas OK')),
            (it.carros_list || []).join('; ')
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Abastecimento Lojas');
    XLSX.writeFile(wb, 'abastecimento_san_marino_fiat.xlsx');
    showToast('Planilha Excel exportada com sucesso!', '📥');
}

// Export Picking Manifest to Excel
function exportarRomaneio() {
    const items = getProcessedItems().filter(it => it.total_retirar > 0);
    items.sort((a, b) => (a.loc_matriz || 'ZZZZ').localeCompare(b.loc_matriz || 'ZZZZ'));

    const rows = [
        ['ROMANEIO DE SEPARAÇÃO - SAN MARINO MATRIZ'],
        ['Data:', new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR')],
        [],
        ['Locação Matriz', 'Código', 'Descrição', 'Total a Retirar', 'Separar Gravataí', 'Separar Zona Sul', 'Separar Viamão', 'Saldo Restante']
    ];

    items.forEach(it => {
        rows.push([
            it.loc_matriz || 'S/L',
            it.codigo,
            it.nome,
            it.total_retirar,
            it.sep_gravatai,
            it.sep_zonasul,
            it.sep_viamao,
            it.saldo_apos_retirar
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Romaneio Separação');
    XLSX.writeFile(wb, 'romaneio_separacao_matriz.xlsx');
    showToast('Romaneio de separação exportado em Excel!', '📥');
}

// Export Purchase Order Recommendation
function exportarCompras() {
    const items = getProcessedItems().filter(it => it.total_enviar > 0 && it.estoque_matriz < it.total_enviar);
    const rows = [
        ['PEDIDO DE COMPRA DE PEÇAS - SAN MARINO FIAT'],
        ['Data:', new Date().toLocaleDateString('pt-BR')],
        [],
        ['Código', 'Descrição', 'Estoque Matriz Atual', 'Falta Gravataí', 'Falta Zona Sul', 'Falta Viamão', 'Qtd Sugerida Compra', 'Custo Unitário']
    ];

    items.forEach(it => {
        const faltaTotal = Math.max(0, it.total_enviar - it.estoque_matriz);
        rows.push([
            it.codigo,
            it.nome,
            it.estoque_matriz,
            it.nec_gravatai,
            it.nec_zonasul,
            it.nec_viamao,
            faltaTotal,
            parseFloat(it.preco_custo) || 0
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pedido Compras');
    XLSX.writeFile(wb, 'pedido_compras_pecas_fiat.xlsx');
    showToast('Pedido de compra exportado em Excel!', '📥');
}

// Initial Setup & Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize parts from embedded dataset
    if (window.INITIAL_PARTS_DATA && window.INITIAL_PARTS_DATA.length > 0) {
        state.parts = JSON.parse(JSON.stringify(window.INITIAL_PARTS_DATA));
    }

    // Populate Vehicle Models Dropdown
    const selectCar = document.getElementById('filterCarroSelect');
    ALL_CAR_MODELS.forEach(car => {
        const opt = document.createElement('option');
        opt.value = car;
        opt.textContent = car;
        selectCar.appendChild(opt);
    });

    // Load saved targets from localStorage
    try {
        const savedTargets = localStorage.getItem('sm_abastecer_targets');
        if (savedTargets) {
            const parsed = JSON.parse(savedTargets);
            state.targets.gravatai = parsed.gravatai ?? 2;
            state.targets.zonasul = parsed.zonasul ?? 2;
            state.targets.viamao = parsed.viamao ?? 2;
            document.getElementById('targetGravatai').value = state.targets.gravatai;
            document.getElementById('targetZonaSul').value = state.targets.zonasul;
            document.getElementById('targetViamao').value = state.targets.viamao;
        }
    } catch (e) {}

    // Load saved theme
    try {
        const savedTheme = localStorage.getItem('sm_abastecer_theme') || 'dark';
        document.body.setAttribute('data-theme', savedTheme);
    } catch (e) {}

    // Target inputs change events
    ['targetGravatai', 'targetZonaSul', 'targetViamao'].forEach(id => {
        const inp = document.getElementById(id);
        inp.addEventListener('input', () => {
            const val = Math.max(0, parseInt(inp.value) || 0);
            if (id === 'targetGravatai') state.targets.gravatai = val;
            if (id === 'targetZonaSul') state.targets.zonasul = val;
            if (id === 'targetViamao') state.targets.viamao = val;

            try {
                localStorage.setItem('sm_abastecer_targets', JSON.stringify(state.targets));
            } catch (e) {}

            // Remove active from presets if custom
            document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
            refreshAllViews();
        });
    });

    // Preset buttons
    document.querySelectorAll('.btn-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const pVal = parseInt(btn.getAttribute('data-preset'));
            state.targets.gravatai = pVal;
            state.targets.zonasul = pVal;
            state.targets.viamao = pVal;
            document.getElementById('targetGravatai').value = pVal;
            document.getElementById('targetZonaSul').value = pVal;
            document.getElementById('targetViamao').value = pVal;

            try {
                localStorage.setItem('sm_abastecer_targets', JSON.stringify(state.targets));
            } catch (e) {}

            refreshAllViews();
            showToast(`Metas ajustadas para ${pVal} unidade(s) por loja`, '🎯');
        });
    });

    // Tabs Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const targetPaneId = btn.getAttribute('data-tab');
            document.getElementById(targetPaneId).classList.add('active');

            if (targetPaneId === 'tabRomaneio') renderTableRomaneio();
            if (targetPaneId === 'tabLojas') renderTabLojas();
            if (targetPaneId === 'tabCompras') renderTableCompras();
        });
    });

    // Search Input with Debounce
    let searchTimeout = null;
    document.getElementById('searchGeral').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            state.filters.search = e.target.value;
            renderTableGeral();
        }, 150);
    });

    // Status Filter Select
    document.getElementById('filterStatus').addEventListener('change', (e) => {
        state.filters.status = e.target.value;
        renderTableGeral();
    });

    // Car Model Filter Select
    document.getElementById('filterCarroSelect').addEventListener('change', (e) => {
        state.filters.car = e.target.value;
        renderTableGeral();
    });

    // Vehicle Family Chips
    document.querySelectorAll('#vehicleChipsBar .chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#vehicleChipsBar .chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.filters.family = chip.getAttribute('data-family');
            renderTableGeral();
        });
    });

    // Clear Filters Button
    document.getElementById('btnLimparFiltros').addEventListener('click', () => {
        state.filters.search = '';
        state.filters.status = 'todos';
        state.filters.family = '';
        state.filters.car = '';

        document.getElementById('searchGeral').value = '';
        document.getElementById('filterStatus').value = 'todos';
        document.getElementById('filterCarroSelect').value = '';
        document.querySelectorAll('#vehicleChipsBar .chip').forEach(c => c.classList.remove('active'));
        document.querySelector('#vehicleChipsBar .chip[data-family=""]').classList.add('active');

        renderTableGeral();
        showToast('Filtros redefinidos!', '🔄');
    });

    // Sortable Table Headers
    document.querySelectorAll('#tabelaGeral thead th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-sort');
            if (state.sort.column === col) {
                state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                state.sort.column = col;
                state.sort.direction = 'desc';
            }
            renderTableGeral();
        });
    });

    // File Upload (Drag & Drop + Input)
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0]);
        }
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    // Theme Toggle
    document.getElementById('btnThemeToggle').addEventListener('click', () => {
        const cur = document.body.getAttribute('data-theme') || 'dark';
        const next = cur === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', next);
        try {
            localStorage.setItem('sm_abastecer_theme', next);
        } catch (e) {}
    });

    // Export Buttons
    document.getElementById('btnExportarExcel').addEventListener('click', exportarTabelaGeral);
    document.getElementById('btnExportarCompras').addEventListener('click', exportarCompras);

    // Print Buttons
    document.getElementById('btnImprimirRomaneio').addEventListener('click', () => {
        document.getElementById('printDate').textContent = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR');
        window.print();
    });

    document.querySelectorAll('.btn-print-branch').forEach(btn => {
        btn.addEventListener('click', () => {
            const branch = btn.getAttribute('data-branch');
            const branchName = branch === 'gravatai' ? 'GRAVATAÍ' : (branch === 'zonasul' ? 'ZONA SUL' : 'VIAMÃO');
            document.getElementById('printHeaderSubtitle').textContent = `GUIA DE REMESSA PARA: SAN MARINO ${branchName} | Data: ${new Date().toLocaleDateString('pt-BR')}`;
            window.print();
        });
    });

    document.getElementById('btnDesmarcarTodosPicking').addEventListener('click', () => {
        state.pickedItems.clear();
        renderTableRomaneio();
        showToast('Todos os itens foram desmarcados.', '🔄');
    });

    // Modal Close
    document.getElementById('btnCloseModal').addEventListener('click', () => {
        document.getElementById('partDetailModal').classList.remove('active');
    });
    document.getElementById('btnFecharModal').addEventListener('click', () => {
        document.getElementById('partDetailModal').classList.remove('active');
    });
    document.getElementById('partDetailModal').addEventListener('click', (e) => {
        if (e.target.id === 'partDetailModal') {
            document.getElementById('partDetailModal').classList.remove('active');
        }
    });

    // Escape Key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.getElementById('partDetailModal').classList.remove('active');
        }
    });

    // Initial Render
    refreshAllViews();
});
