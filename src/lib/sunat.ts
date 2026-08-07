/**
 * Utility helper to query public SUNAT (RUC) and RENIEC (DNI) databases in Peru.
 */

export interface SunatQueryResult {
  success: boolean;
  name?: string;
  address?: string;
  condition?: string;
  state?: string;
  error?: string;
}

export async function lookupRucOrDni(number: string): Promise<SunatQueryResult> {
  const cleanNumber = number.trim().replace(/\D/g, '');

  if (!cleanNumber) {
    return { success: false, error: 'Ingrese un número de RUC (11 dígitos) o DNI (8 dígitos).' };
  }

  if (cleanNumber.length !== 11 && cleanNumber.length !== 8) {
    return { success: false, error: 'El RUC debe tener 11 dígitos o el DNI 8 dígitos.' };
  }

  // 1. Try our Express backend API endpoint first (Bypasses CORS completely)
  try {
    const apiRes = await fetch(`/api/sunat/${cleanNumber}`);
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data.success) {
        return data;
      }
    } else {
      const errData = await apiRes.json().catch(() => null);
      if (errData && errData.error) {
        // If server explicitly returned an error message, save it
        console.warn('Backend SUNAT endpoint message:', errData.error);
      }
    }
  } catch (err) {
    console.warn('Backend API request failed, trying client fallback:', err);
  }

  // 2. Direct client fallback via CORS proxies if backend fails
  if (cleanNumber.length === 11) {
    // Try AllOrigins CORS proxy
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.apis.net.pe/v2/sunat/ruc?numero=${cleanNumber}`)}`;
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const data = await response.json();
        const name = data.razonSocial || data.nombre;
        const address = data.direccion || data.direccionCompleta || `${data.departamento || ''} ${data.provincia || ''} ${data.distrito || ''}`.trim();
        if (name) {
          return {
            success: true,
            name: name.trim(),
            address: address ? address.trim() : '',
            condition: data.condicion || 'HABIDO',
            state: data.estado || 'ACTIVO'
          };
        }
      }
    } catch (e) {
      console.warn('Client proxy fallback error:', e);
    }

    // Fallback for RUC 10 (Persona Natural con Negocio) -> query DNI (digits 3..10)
    if (cleanNumber.startsWith('10')) {
      const dniPart = cleanNumber.substring(2, 10);
      try {
        const proxyDniUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.apis.net.pe/v2/reniec/dni?numero=${dniPart}`)}`;
        const response = await fetch(proxyDniUrl);
        if (response.ok) {
          const data = await response.json();
          const fullName = `${data.nombres || ''} ${data.apellidoPaterno || ''} ${data.apellidoMaterno || ''}`.trim();
          if (fullName) {
            return {
              success: true,
              name: fullName,
              address: '',
              condition: 'HABIDO',
              state: 'ACTIVO'
            };
          }
        }
      } catch (e) {
        console.warn('RUC 10 DNI fallback error:', e);
      }
    }

    return {
      success: false,
      error: 'No se pudieron obtener los datos automáticos en este momento. Puede ingresar el nombre / Razón Social y Dirección Fiscal manualmente.'
    };
  }

  // DNI 8 digits
  try {
    const proxyDniUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.apis.net.pe/v2/reniec/dni?numero=${cleanNumber}`)}`;
    const response = await fetch(proxyDniUrl);
    if (response.ok) {
      const data = await response.json();
      const fullName = `${data.nombres || ''} ${data.apellidoPaterno || ''} ${data.apellidoMaterno || ''}`.trim();
      if (fullName) {
        return {
          success: true,
          name: fullName,
          address: ''
        };
      }
    }
  } catch (e) {
    console.warn('Client DNI proxy fallback error:', e);
  }

  return {
    success: false,
    error: 'No se encontraron datos en RENIEC para el DNI ingresado. Ingrese el nombre manualmente.'
  };
}
