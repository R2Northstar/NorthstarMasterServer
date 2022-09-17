function clearNode($node) {
    $node.textContent = '';
}

function $useSvg(href, width, height) {
    const $svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    $svg.setAttributeNS(null, 'width', width);
    $svg.setAttributeNS(null, 'height', height);
    $svg.setAttributeNS(null, 'viewBox', `0 0 ${width} ${height}`);

    const $use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    $use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${href}`);
    $svg.appendChild($use);

    return $svg;
}

function textboxMount($textbox) {
    const $input = $textbox.getElementsByTagName('input')[0];
    const $clear = document.createElement('button');
    $clear.className = 'clear';
    $clear.onclick = () => {
        $input.value = '';
        $input.dispatchEvent(new Event('input'));
        $input.dispatchEvent(new Event('change'));
    };
    $clear.appendChild($useSvg('clear-icon', 24, 24));
    $textbox.appendChild($clear);
}

const REFETCH_WAIT_MS = 30000; // 30 seconds
const REGION_REGEX = /^\[(.+?)\]/;
const DEFAULT_QUERY = {
    filter: '',
    regions: [],
    gamemodes: [],
    maps: [],
    mods: [],
    includeFull: true,
    includeEmpty: true,
    includePrivate: true,
};
const KNOWN_GAMEMODES = {
    private_match: 'Private Match',
    aitdm: 'Attrition',
    at: 'Bounty Hunt',
    coliseum: 'Coliseum',
    cp: 'Amped Hardpoint',
    ctf: 'Capture the Flag',
    fd_easy: 'Frontier Defense (Easy)',
    fd_hard: 'Frontier Defense (Hard)',
    fd_insane: 'Frontier Defense (Insane)',
    fd_master: 'Frontier Defense (Master)',
    fd_normal: 'Frontier Defense (Regular)',
    lf: 'Live Fire',
    lts: 'Last Titan Standing',
    mfd: 'Marked for Death',
    ps: 'Pilots vs. Pilots',
    solo: 'Campaign',
    tdm: 'Skirmish',
    ttdm: 'Titan Brawl',

    alts: 'Aegis Last Titan Standing',
    attdm: 'Aegis Titan Brawl',
    ffa: 'Free For All',
    fra: 'Free Agents',
    holopilot_lf: 'The Great Bamboozle',
    rocket_lf: 'Rocket Arena',
    turbo_lts: 'Turbo Last Titan Standing',
    turbo_ttdm: 'Turbo Titan Brawl',

    chamber: 'One in the Chamber',
    ctf_comp: 'Competitive CTF',
    fastball: 'Fastball',
    gg: 'Gun Game',
    hidden: 'The Hidden',
    hs: 'Hide and Seek',
    inf: 'Infection',
    kr: 'Amped Killrace',
    sbox: 'Sandbox',
    sns: 'Sticks and Stones',
    tffa: 'Titan FFA',
    tt: 'Titan Tag',

    sp_coop: 'Campaign Coop',
};
const KNOWN_MAPS = {
    mp_angel_city: 'Angel City',
    mp_black_water_canal: 'Black Water Canal',
    mp_box: 'Box',
    mp_coliseum: 'Coliseum',
    mp_coliseum_column: 'Pillars',
    mp_colony02: 'Colony',
    mp_complex3: 'Complex',
    mp_crashsite3: 'Crash Site',
    mp_drydock: 'Drydock',
    mp_eden: 'Eden',
    mp_forwardbase_kodai: 'Forwardbase Kodai',
    mp_glitch: 'Glitch',
    mp_grave: 'Boomtown',
    mp_homestead: 'Homestead',
    mp_lf_deck: 'Deck',
    mp_lf_meadow: 'Meadow',
    mp_lf_stacks: 'Stacks',
    mp_lf_township: 'Township',
    mp_lf_traffic: 'Traffic',
    mp_lf_uma: 'UMA',
    mp_lobby: 'Lobby',
    mp_relic02: 'Relic',
    mp_rise: 'Rise',
    mp_thaw: 'Exoplanet',
    mp_wargames: 'War Games',
};

const $filterInput = document.getElementById('filter');
const $setFiltersButton = document.getElementById('set-filters-button');
const $extraFilters = document.getElementById('extra-filters');
const $regionsInput = document.getElementById('regions');
const $gamemodesInput = document.getElementById('gamemodes');
const $mapsInput = document.getElementById('maps');
const $modsInput = document.getElementById('mods');
const $includeFullInput = document.getElementById('include-full');
const $includeEmptyInput = document.getElementById('include-empty');
const $includePrivateInput = document.getElementById('include-private');
const $serversTable = document.getElementById('servers');
const $lastUpdatedStat = document.getElementById('last-updated-stat');
const $serversListedStat = document.getElementById('servers-listed-stat');
const $serversOnlineStat = document.getElementById('servers-online-stat');
const $playersListedStat = document.getElementById('players-listed-stat');
const $playersOnlineStat = document.getElementById('players-online-stat');

function serializeQuery(searchParams, query) {
    if (query.filter !== '') searchParams.set('filter', query.filter);
    else searchParams.delete('filter');
    if (query.regions.length > 0) searchParams.set('regions', query.regions.join(','));
    else searchParams.delete('regions');
    if (query.gamemodes.length > 0) searchParams.set('gamemodes', query.gamemodes.join(','));
    else searchParams.delete('gamemodes');
    if (query.maps.length > 0) searchParams.set('maps', query.maps.join(','));
    else searchParams.delete('maps');
    if (query.mods.length > 0) searchParams.set('mods', query.mods.join(','));
    else searchParams.delete('mods');
    if (!query.includeFull) searchParams.set('full', 'exclude');
    else searchParams.delete('full');
    if (!query.includeEmpty) searchParams.set('empty', 'exclude');
    else searchParams.delete('empty');
    if (!query.includePrivate) searchParams.set('private', 'exclude');
    else searchParams.delete('private');
}

function deserializeQuery(searchParams) {
    const query = {...DEFAULT_QUERY};
    if (searchParams.has('filter')) query.filter = searchParams.get('filter');
    if (searchParams.has('regions')) query.regions = searchParams.get('regions').split(',');
    if (searchParams.has('gamemodes')) query.gamemodes = searchParams.get('gamemodes').split(',');
    if (searchParams.has('maps')) query.maps = searchParams.get('maps').split(',');
    if (searchParams.has('mods')) query.mods = searchParams.get('mods').split(',');
    if (searchParams.get('full') === 'exclude') query.includeFull = false;
    if (searchParams.get('empty') === 'exclude') query.includeEmpty = false;
    if (searchParams.get('private') === 'exclude') query.includePrivate = false;
    return query;
}

let isMounting = true;
let uiState = {
    state: 'loading',
};
let currentQuery = deserializeQuery(new URL(window.location).searchParams);
const currentSort = {
    sortBy: '',
    sortInverted: false,
};
let currentServerId = undefined;

let overlayState = {
    state: 'none',
};

function setQueryParam(param, value) {
    if (isMounting || value === currentQuery[param]) return;
    setCurrentQuery({
        ...currentQuery,
        [param]: value,
    });
}

function setCurrentQuery(newQuery) {
    currentQuery = newQuery;
    uiQueueRender();

    const url = new URL(window.location);
    serializeQuery(url.searchParams, currentQuery);
    if (url.toString() !== window.location.toString()) {
        window.history.replaceState({}, '', url);
    }
}

function simplifyRegion(region) {
    return region.toUpperCase().replace(/ /g, "-");
}

function displayGamemode(gamemode) {
    return KNOWN_GAMEMODES[gamemode] || gamemode;
}

function displayMap(map) {
    return KNOWN_MAPS[map] || map;
}

function displayMod(mod) {
    return `${mod.Name} ${mod.Version}`;
}

function getServerDisplayProp(server, prop) {
    switch (prop) {
        case 'playlist': return displayGamemode(server.playlist);
        case 'map': return displayMap(server.map);
        default: return server[prop];
    }
}

function getServerJoinUrl(server, password) {
    const baseUrl = `northstar://server@${server.id}`;
    if (password) {
        return `${baseUrl}:${btoa(password)}`;
    } else {
        return baseUrl;
    }
}

function createMenu(openByDefault, openCb, closeCb) {
    let isOpen = false;

    const open = e => {
        if (isOpen) {
            e.stopPropagation();
            return;
        }
        isOpen = true;

        setTimeout(() => {
            const clickHandler = () => {
                isOpen = false;
                document.body.removeEventListener('click', clickHandler);
                closeCb();
            };
            document.body.addEventListener('click', clickHandler);
        });
        openCb();
    };
    if (openByDefault) open();
    return open;
}

function uiJoinServer(server) {
    if (!server.hasPassword) {
        window.location = getServerJoinUrl(server, '');
        return;
    }

    overlayState = {
        state: 'passwordPrompt',
        server,
    };
    uiRenderOverlay();
}

function uiGetServerList() {
    switch (uiState.state) {
        case 'loading':
        case 'error':
            return [];
        case 'ready':
            return uiState.servers;
        default: throw new Error(`Unknown UI state ${uiState.state}`);
    }
}

function uiUpdateSelectors() {
    const serverList = uiGetServerList();

    const regionsSet = new Set();
    const modsSet = new Set();

    for (const server of serverList) {
        const regionMatch = server.name.match(REGION_REGEX);
        if (regionMatch !== null) {
            regionsSet.add(simplifyRegion(regionMatch[1]));
        }

        for (const mod of server.modInfo.Mods) {
            modsSet.add(displayMod(mod));
        }
    }

    const regions = Array.from(regionsSet);
    regions.sort();
    const mods = Array.from(modsSet);
    mods.sort();

    dropdownSetEntries($regionsInput, regions.map(region => [region, region]));
    dropdownSetEntries($modsInput, mods.map(mod => [mod, mod]));
}

let uiIsRenderQueued = false;
function uiQueueRender() {
    if (uiIsRenderQueued) return;
    uiIsRenderQueued = true;
    queueMicrotask(() => {
        uiIsRenderQueued = false;
        uiRender();
    });
}

function uiRender() {
    const serverList = uiGetServerList();
    const filteredServerList = serverList.filter(server => {
        if (currentQuery.filter !== '' && server.name.toLowerCase().indexOf(currentQuery.filter.toLowerCase()) === -1) {
            return false;
        }
        if (currentQuery.regions.length > 0) {
            const simplifiedName = simplifyRegion(server.name);
            if (!currentQuery.regions.some(region => simplifiedName.startsWith(`[${region}]`))) {
                return false;
            }
        }
        if (currentQuery.gamemodes.length > 0 && currentQuery.gamemodes.indexOf(server.playlist) === -1) {
            return false;
        }
        if (currentQuery.maps.length > 0 && currentQuery.maps.indexOf(server.map) === -1) {
            return false;
        }
        if (!currentQuery.mods.every(modName => server.modInfo.Mods.some(mod => displayMod(mod) === modName))) {
            return false;
        }
        if (!currentQuery.includeFull && server.playerCount === server.maxPlayers) {
            return false;
        }
        if (!currentQuery.includeEmpty && server.playerCount === 0) {
            return false;
        }
        if (!currentQuery.includePrivate && server.hasPassword) {
            return false;
        }

        return true;
    });

    if (currentSort.sortBy) {
        filteredServerList.sort((a, b) => {
            let isABeforeB;
            const aVal = getServerDisplayProp(a, currentSort.sortBy);
            const bVal = getServerDisplayProp(b, currentSort.sortBy);
            if (typeof aVal === 'string') {
                isABeforeB = aVal.localeCompare(bVal) > 0;
            } else {
                isABeforeB = aVal < bVal;
            }

            if (currentSort.sortInverted) isABeforeB = !isABeforeB;
            return isABeforeB ? 1 : -1;
        });
    }

    clearNode($serversTable);
    for (const server of filteredServerList) {
        const $row = document.createElement('div');
        $row.classList.add('table-row');
        if (server.hasPassword) {
            $row.classList.add('server-private');
        }

        const playTitle = 'Join this server on Northstar';
        const $actionCell = document.createElement('div');
        $actionCell.title = playTitle;
        if (server.hasPassword) {
            $actionCell.appendChild($useSvg('lock-icon', 24, 24));
        }
        const $playButton = $useSvg('play-icon', 24, 24);
        $playButton.classList.add('play');
        $actionCell.appendChild($playButton);
        $actionCell.onclick = e => {
            if (currentServerId !== server.id) {
                e.stopPropagation();
                uiJoinServer(server);
            }
        };
        $row.appendChild($actionCell);

        const $detailsCell = document.createElement('div');
        $detailsCell.classList.add('server-details');
        const $serverName = document.createElement('h3');
        if (currentQuery.filter !== '') {
            const filterIndex = server.name.toLowerCase().indexOf(currentQuery.filter.toLowerCase());
            $serverName.append(server.name.substring(0, filterIndex));

            const $highlight = document.createElement('span');
            $highlight.textContent = server.name.substring(filterIndex, filterIndex + currentQuery.filter.length);
            $serverName.appendChild($highlight);

            $serverName.append(server.name.substring(filterIndex + currentQuery.filter.length));
        } else {
            $serverName.textContent = server.name;
        }
        $detailsCell.appendChild($serverName);

        const $details = document.createElement('div');
        $details.classList.add('server-details-extra');

        const $description = document.createElement('p');
        $description.textContent = server.description;
        $details.appendChild($description);

        const $mods = document.createElement('ul');
        for (const mod of server.modInfo.Mods) {
            const $mod = document.createElement('li');
            $mod.textContent = `${mod.Name} ${mod.Version}`;
            $mods.appendChild($mod);
        }
        $details.append($mods);

        const $longJoinButton = document.createElement('button');
        $longJoinButton.classList.add('play-button');
        $longJoinButton.appendChild($useSvg('play-icon', 24, 24));
        $longJoinButton.append('Join server');
        $longJoinButton.onclick = () => uiJoinServer(server);
        $details.appendChild($longJoinButton);

        $detailsCell.appendChild($details);
        $row.appendChild($detailsCell);

        const $playersCell = document.createElement('div');
        $playersCell.textContent = `${server.playerCount}/${server.maxPlayers}`;
        $row.appendChild($playersCell);

        const $gamemodeCell = document.createElement('div');
        $gamemodeCell.textContent = displayGamemode(server.playlist);
        $row.appendChild($gamemodeCell);

        const $mapCell = document.createElement('div');
        $mapCell.textContent = displayMap(server.map);
        $row.appendChild($mapCell);

        $row.onclick = createMenu(
            currentServerId === server.id,
            () => {
                currentServerId = server.id;
                $row.classList.add('server-selected');
                $actionCell.title = '';
            },
            () => {
                if (currentServerId === server.id) currentServerId = undefined;
                $row.classList.remove('server-selected');
                $actionCell.title = playTitle;
            }
        );

        $serversTable.appendChild($row);
    }

    if (uiState.state === 'loading') {
        $lastUpdatedStat.textContent = 'never';
    } else if (uiState.state === 'ready') {
        $lastUpdatedStat.textContent = uiState.updated.toLocaleTimeString();
    }

    $serversListedStat.textContent = filteredServerList.length.toString();
    $serversOnlineStat.textContent = serverList.length.toString();
    $playersListedStat.textContent = `${filteredServerList.reduce((sum, server) => sum + server.playerCount, 0)} / ${filteredServerList.reduce((sum, server) => sum + server.maxPlayers, 0)}`;
    $playersOnlineStat.textContent = `${serverList.reduce((sum, server) => sum + server.playerCount, 0)} / ${serverList.reduce((sum, server) => sum + server.maxPlayers, 0)}`;
}

function uiCloseOverlay() {
    overlayState = { state: 'none' };
    uiRenderOverlay();
}

function uiOverlayHandleEsc(e) {
    if (e.key === 'Escape') {
        uiCloseOverlay();
    }
}

function uiRenderOverlay() {
    const currentState = overlayState;

    const $overlay = document.getElementById('overlay');
    if ($overlay) {
        $overlay.remove();
    }

    document.body.removeEventListener('keydown', uiOverlayHandleEsc);
    if (currentState.state !== 'none') {
        document.body.addEventListener('keydown', uiOverlayHandleEsc);
    }

    if (currentState.state === 'passwordPrompt') {
        const $overlay = document.createElement('div');
        $overlay.id = 'overlay';

        const $dialog = document.createElement('div');

        const $body = document.createElement('p');
        $body.textContent = currentState.server.name;
        $dialog.appendChild($body);

        const $form = document.createElement('form');

        const $input = document.createElement('input');
        $input.type = 'password';
        $input.placeholder = 'Server password';
        $form.appendChild($input);
        const $continue = document.createElement('button');
        $continue.appendChild($useSvg('arrow-right-icon', 24, 24));
        $form.appendChild($continue);

        $dialog.appendChild($form);
        $overlay.appendChild($dialog);

        document.body.appendChild($overlay);

        setTimeout(() => $input.focus(), 0);
        $overlay.onclick = e => {
            e.stopPropagation();
            uiCloseOverlay();
        }
        $dialog.onclick = e => e.stopPropagation();
        $form.onsubmit = e => {
            e.preventDefault();
            window.location = getServerJoinUrl(currentState.server, $input.value);
            uiCloseOverlay();
        };
    }
}

function dropdownMount($dropdown) {
    clearNode($dropdown);

    $dropdown.onclick = createMenu(
        false,
        () => $dropdown.classList.add('dropdown-open'),
        () => $dropdown.classList.remove('dropdown-open'),
    );

    const $header = document.createElement('div');
    $header.className = 'dropdown-header';
    $dropdown.appendChild($header);

    const $clear = document.createElement('button');
    $clear.className = 'clear';
    $clear.onclick = e => {
        e.stopPropagation();
        dropdownSetSelectedEntries($dropdown, []);
    };
    $clear.appendChild($useSvg('clear-icon', 24, 24));
    $dropdown.appendChild($clear);

    const $items = document.createElement('div');
    $items.className = 'dropdown-items';
    $dropdown.appendChild($items);
    $items.onclick = e => e.stopPropagation();

    dropdownUpdate($dropdown);
}

let dropdownIgnoreUpdates = false;
function dropdownUpdate($dropdown) {
    if (dropdownIgnoreUpdates) return;

    const $items = $dropdown.getElementsByClassName('dropdown-items')[0];
    const checkboxes = $items.getElementsByTagName('input');

    const selectedEntries = [];
    for (const $checkbox of checkboxes) {
        if ($checkbox.checked) {
            selectedEntries.push([
                $checkbox.value,
                $checkbox.dataset.name,
            ]);
        }
    }

    dropdownForceSetSelectedEntries($dropdown, selectedEntries);
}

function dropdownForceSetSelectedEntries($dropdown, selectedEntries) {
    const $header = $dropdown.getElementsByClassName('dropdown-header')[0];

    if (selectedEntries.length === 0) {
        $header.innerHTML = $dropdown.classList.contains('dropdown-and') ? '<span>Any</span>' : '<span>All</span>';
    } else {
        clearNode($header);
        for (const [, name] of selectedEntries) {
            const $span = document.createElement('span');
            $span.textContent = name;
            $header.appendChild($span);
        }
    }

    setQueryParam($dropdown.id, selectedEntries.map(([value]) => value));
}

function dropdownSetEntries($dropdown, entries) {
    const $items = $dropdown.getElementsByClassName('dropdown-items')[0];
    const selectedValues = currentQuery[$dropdown.id];
    clearNode($items);
    for (const [entryValue, entryName] of entries) {
        const $label = document.createElement('label');
        const $input = document.createElement('input');
        $input.type = 'checkbox';
        $input.value = entryValue;
        $input.dataset.name = entryName;
        $input.checked = selectedValues.indexOf(entryValue) !== -1;
        $input.onchange = () => dropdownUpdate($dropdown);
        $label.appendChild($input);
        $label.append(entryName);
        $items.appendChild($label);
    }
    dropdownUpdate($dropdown);
}

function dropdownSetSelectedEntries($dropdown, selectedEntries) {
    const $items = $dropdown.getElementsByClassName('dropdown-items')[0];
    const checkboxes = $items.getElementsByTagName('input');
    const selectedValues = new Set(selectedEntries.map(([value]) => value));

    dropdownIgnoreUpdates = true;
    for (const $checkbox of checkboxes) {
        $checkbox.checked = selectedValues.has($checkbox.value);
    }
    dropdownIgnoreUpdates = false;
    dropdownForceSetSelectedEntries($dropdown, selectedEntries);
}

function sortRemoveClasses() {
    for (const currentSortDown of document.getElementsByClassName('sort-down')) {
        currentSortDown.classList.remove('sort-down');
    }
    for (const currentSortUp of document.getElementsByClassName('sort-up')) {
        currentSortUp.classList.remove('sort-up');
    }
}

function sortClear() {
    sortRemoveClasses();
    currentSort.sortBy = '';
    uiQueueRender();
}

function sortSetTo($header, isInverted) {
    sortRemoveClasses();

    if (isInverted) {
        $header.classList.add('sort-up');
    } else {
        $header.classList.add('sort-down');
    }
    currentSort.sortBy = $header.dataset.by;
    currentSort.sortInverted = isInverted;
    uiQueueRender();
}

function sortToggle($header) {
    if ($header.classList.contains('sort-down')) {
        sortSetTo($header, true);
    } else if ($header.classList.contains('sort-up')) {
        sortClear();
    } else {
        sortSetTo($header, false);
    }
}

async function fetchServerList() {
    try {
        document.body.classList.remove('error-state');
        if (uiState.state !== 'ready') {
            document.body.classList.add('loading-state');
        }
        const res = await fetch('/client/servers');
        const servers = await res.json();
        uiState = {
            state: 'ready',
            servers,
            updated: new Date(),
        };
        document.body.classList.remove('loading-state');
    } catch (err) {
        console.error('Failed to fetch server list:', err);
        uiState = { state: 'error' };
        document.body.classList.remove('loading-state');
        document.body.classList.add('error-state');
    }

    uiUpdateSelectors();
    uiQueueRender();
}

let nextRefetchTimeout = 0;
async function refetchLoopTrigger() {
    clearTimeout(nextRefetchTimeout);
    await fetchServerList();
    nextRefetchTimeout = setTimeout(refetchLoopTrigger, REFETCH_WAIT_MS);
}

document.getElementById('form').onsubmit = e => e.preventDefault();

for (const $dropdown of document.getElementsByClassName('dropdown')) {
    dropdownMount($dropdown);
}
for (const $textbox of document.getElementsByClassName('textbox')) {
    textboxMount($textbox);
}
for (const $header of document.getElementsByClassName('table-header')) {
    $header.onclick = () => sortToggle($header);
    $header.appendChild($useSvg('arrow-down-icon', 24, 24));
}

dropdownSetEntries($gamemodesInput, Object.entries(KNOWN_GAMEMODES));
dropdownSetEntries($mapsInput, Object.entries(KNOWN_MAPS));

$filterInput.oninput = () => setQueryParam('filter', $filterInput.value);
$includeFullInput.onchange = () => setQueryParam('includeFull', $includeFullInput.checked);
$includeEmptyInput.onchange = () => setQueryParam('includeEmpty', $includeEmptyInput.checked);
$includePrivateInput.onchange = () => setQueryParam('includePrivate', $includePrivateInput.checked);

sortSetTo(document.getElementById('players-header'), false);

let areFiltersOpen = false;
$setFiltersButton.onclick = () => {
    if (areFiltersOpen) {
        areFiltersOpen = false;
        $extraFilters.classList.add('form-collapse');
        $setFiltersButton.textContent = 'Set filters...';
    } else {
        areFiltersOpen = true;
        $extraFilters.classList.remove('form-collapse');
        $setFiltersButton.textContent = 'Close';
    }
};

// Update fields to match the current query
$filterInput.value = currentQuery.filter;
dropdownSetSelectedEntries($regionsInput, currentQuery.regions.map(region => [region, region]));
dropdownSetSelectedEntries($gamemodesInput, currentQuery.gamemodes.map(gamemode => [gamemode, displayGamemode(gamemode)]));
dropdownSetSelectedEntries($mapsInput, currentQuery.maps.map(map => [map, displayMap(map)]));
dropdownSetSelectedEntries($modsInput, currentQuery.mods.map(mod => [mod, mod]));
$includeFullInput.checked = currentQuery.includeFull;
$includeEmptyInput.checked = currentQuery.includeEmpty;
$includePrivateInput.checked = currentQuery.includePrivate;

isMounting = false;

refetchLoopTrigger();