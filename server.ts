import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory cache for fast repeat lookups
const lookupCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

// Safe JSON Fetcher with user agents & timeout
async function fetchJsonSafe(url: string, headers: Record<string, string> = {}): Promise<any> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        ...headers
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

// Safe HTML Fetcher for SUNAT Portal Scraping
async function fetchHtmlSafe(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

// Helper to extract clean full name from any DNI API response structure
function extractDniName(data: any): string | null {
  if (!data) return null;
  const t = data.data || data.result || data.payload || data;

  // Pattern 1: Separate names and surnames
  if (t.nombres) {
    const first = String(t.nombres).trim();
    const pat = String(t.apellidoPaterno || t.apellido_paterno || t.paterno || '').trim();
    const mat = String(t.apellidoMaterno || t.apellido_materno || t.materno || '').trim();
    const full = `${first} ${pat} ${mat}`.trim();
    if (full.length > 3) return full;
  }

  // Pattern 2: Single name string fields
  const single = t.nombre || t.full_name || t.nombre_completo || t.razonSocial || t.resultado || t.nombres_completos;
  if (single && typeof single === 'string' && single.trim().length > 3) {
    return single.trim();
  }

  return null;
}

// Helper to extract clean RUC data (Name, Address, Condition, State)
function extractRucData(data: any) {
  if (!data) return null;
  const t = data.data || data.result || data.payload || data;

  const name = t.razonSocial || t.razon_social || t.nombre || t.nombre_o_razon_social || t.contribuyente;
  if (!name || typeof name !== 'string' || name.trim().length < 2) return null;

  let address = t.direccion || t.direccionCompleta || t.direccion_fiscal || t.domicilio_fiscal || t.domicilio || '';
  if (!address && (t.departamento || t.provincia || t.distrito)) {
    address = `${t.departamento || ''} ${t.provincia || ''} ${t.distrito || ''}`.trim();
  }

  return {
    success: true,
    name: String(name).trim(),
    address: address ? String(address).trim() : '',
    condition: t.condicion || t.condicion_domicilio || 'HABIDO',
    state: t.estado || t.estado_contribuyente || 'ACTIVO'
  };
}

// Scrape official SUNAT consultation portal directly
async function scrapeSunatPortal(ruc: string) {
  const url = `https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/jcrS00Alias?accion=consPorRuc&nroRuc=${ruc}`;
  const html = await fetchHtmlSafe(url);
  if (!html) return null;

  try {
    let name = '';
    // Look for pattern: 10749052703 - JUAN PEREZ GOMEZ
    const matchRucName = html.match(/(\d{11})\s*-\s*([^\r\n<]+)/);
    if (matchRucName && matchRucName[2]) {
      name = matchRucName[2].trim();
    } else {
      const matchRazon = html.match(/Razón Social[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
      if (matchRazon && matchRazon[1]) {
        name = matchRazon[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      }
    }

    // Look for Domicilio Fiscal
    let address = '';
    const matchDir = html.match(/Domicilio Fiscal:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
    if (matchDir && matchDir[1]) {
      address = matchDir[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    }

    if (name) {
      return {
        success: true,
        name,
        address: address || '',
        condition: 'HABIDO',
        state: 'ACTIVO',
        source: 'SUNAT Portal Directo'
      };
    }
  } catch (e) {
    console.warn('Scraper error:', e);
  }
  return null;
}

// Calculate exact RUC 10 (Persona Natural) for an 8-digit Peruvian DNI
function calculateRuc10(dni: string): string | null {
  const cleanDni = dni.trim().replace(/\D/g, '');
  if (cleanDni.length !== 8) return null;
  const digits = [1, 0, ...cleanDni.split('').map(Number)];
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * weights[i];
  }
  const remainder = sum % 11;
  let check = 11 - remainder;
  if (check === 10) check = 0;
  if (check === 11) check = 1;
  return `10${cleanDni}${check}`;
}

// Query RENIEC / SUNAT for DNI (8 digits) with multiple fallback providers
async function lookupDni(dni: string) {
  const cleanDni = dni.trim().replace(/\D/g, '');
  if (cleanDni.length !== 8) return null;

  // Method 1: Check SUNAT official portal using exact calculated RUC 10
  const ruc10 = calculateRuc10(cleanDni);
  if (ruc10) {
    const sunatRes = await scrapeSunatPortal(ruc10);
    if (sunatRes && sunatRes.name) {
      return {
        success: true,
        name: sunatRes.name,
        address: sunatRes.address || '',
        source: 'SUNAT / RENIEC (Persona Natural)'
      };
    }
  }

  // Method 2: Public RENIEC / DNI APIs
  const endpoints = [
    `https://api.apis.net.pe/v1/dni?numero=${cleanDni}`,
    `https://api.apis.net.pe/v2/reniec/dni?numero=${cleanDni}`,
    `https://dniruc.apisperu.com/api/v1/dni/${cleanDni}`,
    `https://api.factiliza.com/peru/v1/dni/info/${cleanDni}`,
    `https://consultaruc.isunat.com/api/dni/${cleanDni}`,
    `https://api.perudevs.com/api/v1/dni/complete?document=${cleanDni}`,
    `https://api.perudevs.com/api/v1/dni?document=${cleanDni}`,
    `https://apiperu.dev/api/dni/${cleanDni}`,
    `https://api.atypical.pe/dni/${cleanDni}`,
    `https://api.consultasperu.com/api/v1/dni?dni=${cleanDni}`,
    `https://api.reniec.cloud/dni/${cleanDni}`,
    `https://peruapi.com/api/v1/dni/${cleanDni}`,
    `https://consultaqrr.sutran.gob.pe/api/dni/${cleanDni}`
  ];

  for (const url of endpoints) {
    const data = await fetchJsonSafe(url);
    const fullName = extractDniName(data);
    if (fullName) {
      return {
        success: true,
        name: fullName,
        address: '',
        source: 'RENIEC Database'
      };
    }
  }

  // Method 3: Fallback JNE / ONPE / PeruDevs public endpoints
  try {
    const jneData = await fetchJsonSafe(`https://api.perudevs.com/api/v1/dni/simple?document=${cleanDni}`);
    const jneName = extractDniName(jneData);
    if (jneName) {
      return {
        success: true,
        name: jneName,
        address: '',
        source: 'RENIEC JNE'
      };
    }
  } catch {
    // Ignore error
  }

  return null;
}

// Query SUNAT for RUC (11 digits)
async function lookupRuc(ruc: string) {
  // Tier 1: Try public JSON APIs
  const jsonEndpoints = [
    `https://api.apis.net.pe/v1/ruc?numero=${ruc}`,
    `https://api.apis.net.pe/v2/sunat/ruc?numero=${ruc}`,
    `https://dniruc.apisperu.com/api/v1/ruc/${ruc}`,
    `https://api.factiliza.com/peru/v1/ruc/info/${ruc}`,
    `https://consultaruc.isunat.com/api/ruc/${ruc}`,
    `https://api.perudevs.com/api/v1/ruc/full?document=${ruc}`,
    `https://api.perudevs.com/api/v1/ruc?document=${ruc}`,
    `https://apiperu.dev/api/ruc/${ruc}`
  ];

  for (const url of jsonEndpoints) {
    const data = await fetchJsonSafe(url);
    const parsed = extractRucData(data);
    if (parsed) return parsed;
  }

  // Tier 2: Try scraping official SUNAT portal directly
  const portalResult = await scrapeSunatPortal(ruc);
  if (portalResult) return portalResult;

  // Tier 3: If RUC 10 (Persona Natural con Negocio, e.g., 10749052703)
  // The digits 3..10 are the person's DNI! (e.g. 74905270)
  if (ruc.startsWith('10') && ruc.length === 11) {
    const dniPart = ruc.substring(2, 10);
    const dniResult = await lookupDni(dniPart);
    if (dniResult && dniResult.name) {
      return {
        success: true,
        name: dniResult.name,
        address: '',
        condition: 'HABIDO',
        state: 'ACTIVO',
        source: 'RENIEC (Persona Natural RUC 10)'
      };
    }
  }

  return null;
}

// Server-side SUNAT / RENIEC Lookup Route
app.get("/api/sunat/:number", async (req, res) => {
  const num = req.params.number.trim().replace(/\D/g, '');

  if (!num) {
    return res.status(400).json({ success: false, error: 'Ingrese un número de RUC o DNI.' });
  }

  // Check cache first
  const cached = lookupCache.get(num);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return res.json(cached.data);
  }

  if (num.length === 11) {
    const rucResult = await lookupRuc(num);
    if (rucResult) {
      lookupCache.set(num, { data: rucResult, timestamp: Date.now() });
      return res.json(rucResult);
    }
    return res.status(404).json({
      success: false,
      error: 'No se encontraron datos automáticos para el RUC ingresado. Puede ingresar la Razón Social y Dirección Fiscal manualmente.'
    });
  }

  if (num.length === 8) {
    const dniResult = await lookupDni(num);
    if (dniResult) {
      lookupCache.set(num, { data: dniResult, timestamp: Date.now() });
      return res.json(dniResult);
    }
    return res.status(404).json({
      success: false,
      error: 'No se encontraron datos en RENIEC para el DNI ingresado. Puede ingresar el nombre del cliente manualmente.'
    });
  }

  return res.status(400).json({
    success: false,
    error: 'El número ingresado debe ser RUC (11 dígitos) o DNI (8 dígitos).'
  });
});

// Vite middleware for development mode
if (process.env.NODE_ENV !== "production") {
  startDevServer();
} else {
  startProdServer();
}

async function startDevServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Dev Server running on http://0.0.0.0:${PORT}`);
  });
}

function startProdServer() {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Prod Server running on http://0.0.0.0:${PORT}`);
  });
}
