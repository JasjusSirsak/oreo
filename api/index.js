require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// Koneksi ke PostgreSQL, ada di dibagian env
const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test koneksi database saat startup
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      timestamp: result.rows[0].now 
    });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(500).json({ 
      status: 'unhealthy', 
      error: err.message 
    });
  }
});

// ENDPOINT BARU UNTUK VISUALISASI DASHBOARD
app.get('/api/visualization-data', async (req, res) => {
  try {
    console.log('🔍 Fetching visualization data from DataProject...');
    
    // Query untuk cek struktur kolom - GUNAKAN TANDA KUTIP
    const sampleQuery = `SELECT * FROM "DataProject" LIMIT 5`;
    const { rows: sampleRows } = await pool.query(sampleQuery);
    
    // Log struktur kolom untuk debugging
    if (sampleRows.length > 0) {
      console.log('📋 Kolom yang tersedia di tabel DataProject:', Object.keys(sampleRows[0]));
      console.log('🔍 Sample data untuk debugging tahun:');
      sampleRows.forEach((row, index) => {
        console.log(`   Row ${index + 1}:`, {
          JUDUL: row.JUDUL,
          TAHUN: row.TAHUN,
          tahun: row.tahun,
          TAHUN_ANGGARAN: row.TAHUN_ANGGARAN,
          tahun_anggaran: row.tahun_anggaran,
          YEAR: row.YEAR,
          year: row.year,
          extracted_at: row.extracted_at,
          _airbyte_extracted_at: row._airbyte_extracted_at
        });
      });
    }
    
    // Ambil semua data dari tabel DataProject - GUNAKAN TANDA KUTIP
    const allProjectsQuery = `SELECT * FROM "DataProject"`;
    const { rows: projectRows } = await pool.query(allProjectsQuery);
    
    console.log(`📊 Total data dari DataProject: ${projectRows.length}`);
    
    // Extract tahun dari berbagai kemungkinan kolom
    const currentYear = new Date().getFullYear();
    
    // Kumpulkan semua tahun yang ditemukan untuk debugging
    const allYearsFound = new Set();
    
    // Transform projects - SESUAIKAN DENGAN KOLOM YANG ADA DI DataProject
    const projects = projectRows.map((row, index) => {
      // Cari tahun dari berbagai kemungkinan kolom - PERBAIKAN DI SINI
      let year = currentYear;
      let yearSource = 'default';
      
      // Prioritaskan kolom tahun yang eksplisit
      if (row.TAHUN && !isNaN(row.TAHUN)) {
        year = parseInt(row.TAHUN);
        yearSource = 'TAHUN';
      } else if (row.tahun && !isNaN(row.tahun)) {
        year = parseInt(row.tahun);
        yearSource = 'tahun';
      } else if (row.TAHUN_ANGGARAN && !isNaN(row.TAHUN_ANGGARAN)) {
        year = parseInt(row.TAHUN_ANGGARAN);
        yearSource = 'TAHUN_ANGGARAN';
      } else if (row.tahun_anggaran && !isNaN(row.tahun_anggaran)) {
        year = parseInt(row.tahun_anggaran);
        yearSource = 'tahun_anggaran';
      } else if (row.YEAR && !isNaN(row.YEAR)) {
        year = parseInt(row.YEAR);
        yearSource = 'YEAR';
      } else if (row.year && !isNaN(row.year)) {
        year = parseInt(row.year);
        yearSource = 'year';
      }
      // Fallback ke timestamp
      else if (row.extracted_at) {
        year = new Date(row.extracted_at).getFullYear();
        yearSource = 'extracted_at';
      } else if (row._airbyte_extracted_at) {
        year = new Date(row._airbyte_extracted_at).getFullYear();
        yearSource = '_airbyte_extracted_at';
      }
      
      // Tambahkan ke set untuk debugging
      allYearsFound.add(year);
      
      // Cari judul dari berbagai kemungkinan kolom
      const title = row.JUDUL || row.judul || row.title || row.Judul || 'Untitled Project';
      
      // Cari detail/deskripsi dari berbagai kolom
      const detail = row.DESKRIPSI_PROGRAM || row.deskripsi || row.detail || row.Skema_Program || row.scheme || 'Tidak ada detail tersedia';
      
      // Cari peneliti dari berbagai kolom
      const researcher = row.PENELITI || row.PENGUSUL || row.peneliti || row.researcher || row.Peneliti || '';

      console.log(`📝 Project ${index + 1}:`, { 
        title, 
        researcher,
        year,
        yearSource 
      });

      return {
        id: `proj_${index + 1}`,
        name: title,
        year: year,
        detail: detail,
        image: 'https://via.placeholder.com/200/c92a2a/ffffff?text=Project',
        researchers: researcher ? [researcher.split(',')[0].trim()] : []
      };
    });
    
    // Log semua tahun yang ditemukan
    console.log('📅 Semua tahun yang ditemukan:', Array.from(allYearsFound).sort());
    console.log(`📊 Distribusi tahun: ${projects.length} projects`);
    projects.forEach(p => {
      console.log(`   - Tahun ${p.year}: ${projects.filter(proj => proj.year === p.year).length} projects`);
    });
    
    // Extract unique researchers dari projects
    const researcherMap = new Map();
    
    projectRows.forEach((row, index) => {
      // Cari peneliti dari berbagai kolom
      const researcher = row.PENELITI || row.PENGUSUL || row.peneliti || row.researcher || row.Peneliti || '';

      if (researcher) {
        const researchers = researcher.split(',').map(r => r.trim());
        console.log(`👨‍🔬 Researchers untuk project ${index + 1}:`, researchers);
          
        researchers.forEach(name => {
          if (name && !researcherMap.has(name)) {
            researcherMap.set(name, {
              id: name.toLowerCase().replace(/\s+/g, '_'),
              name: name,
              position: row.UNIT_PENGUSUL || row.unit || 'Researcher',
              expertise: row.SKEMA_PROGRAM || row.scheme || 'General Research',
              image: 'https://via.placeholder.com/200/495057/ffffff?text=' + name.charAt(0),
              projects: []
            });
          }
        });
      }
    });
    
    const researchers = Array.from(researcherMap.values());
    
    // Link projects to researchers
    projects.forEach(project => {
      project.researchers.forEach(researcherName => {
        const researcherId = researcherName.toLowerCase().replace(/\s+/g, '_');
        const researcher = researchers.find(r => r.id === researcherId);
        if (researcher && !researcher.projects.includes(project.id)) {
          researcher.projects.push(project.id);
        }
        // Update project researchers dengan ID
        const researcherIndex = project.researchers.indexOf(researcherName);
        if (researcherIndex !== -1) {
          project.researchers[researcherIndex] = researcherId;
        }
      });
    });
    
    const visualizationData = {
      projects: projects,
      researchers: researchers
    };
    
    console.log(`✅ Prepared ${projects.length} projects and ${researchers.length} researchers`);
    console.log(`📅 Tahun-tahun unik yang tersedia:`, [...new Set(projects.map(p => p.year))].sort());
    
    res.json({
      success: true,
      data: visualizationData
    });
    
  } catch (err) {
    console.error('❌ Error fetching visualization data:');
    console.error('Error details:', err.message);
    console.error('Error stack:', err.stack);
    
    res.status(500).json({ 
      success: false,
      error: 'Gagal mengambil data visualisasi',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}); 

// Endpoi nt untuk tabel DataProject - GUNAKAN TANDA KUTIP
app.get('/api/DataProject', async (req, res) => {
  try {
    const limit = Math.min(1000, Number(req.query.limit) || 1000);
    const offset = Number(req.query.offset) || 0;

    const query = `SELECT * FROM "DataProject" LIMIT $1 OFFSET $2`;

    console.log('🔍 Fetching DataProject table...');
    const { rows } = await pool.query(query, [limit, offset]);
    console.log(`✅ Got ${rows.length} rows from DataProject`);
    
    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('❌ Error fetching DataProject:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Gagal mengambil data dari tabel DataProject',
      details: err.message
    });
  }
});

// Endpoint untuk mengambil detail berdasarkan Judul (DataProject) - GUNAKAN TANDA KUTIP
app.get('/api/DataProject/:judul', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM "DataProject" WHERE "JUDUL" = $1', 
      [req.params.judul]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Data tidak ditemukan' 
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (err) {
    console.error('Error fetching detail DataProject:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Endpoint tidak ditemukan',
    available_endpoints: [
      'GET /health',
      'GET /api/visualization-data',
      'GET /api/DataProject',
      'GET /api/DataProject/:judul',
    ]
  });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 API Server running on http://localhost:${port}`);
  console.log(`📊 Endpoints available:`);
  console.log(`   - GET /health`);
  console.log(`   - GET /api/visualization-data (NEW!)`);
  console.log(`   - GET /api/DataProject`);
  console.log(`   - GET /api/DataProject/:JUDUL`);
});