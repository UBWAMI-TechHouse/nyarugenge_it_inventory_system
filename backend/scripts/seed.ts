import "dotenv/config";
import bcrypt from "bcryptjs";
import pool from "../src/db/pool";
import { logger } from "../src/middleware/logger";

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    logger.info("Seeding database…");

    // ─── Departments ──────────────────────────────────────────────────────────
    const depts = await client.query(`
      INSERT INTO departments (id, name, code, description, created_at) VALUES
        ('d1111111-0000-0000-0000-000000000001', 'ICT',            'ICT', 'Information & Communication Technology', '2020-01-01'),
        ('d2222222-0000-0000-0000-000000000002', 'Finance',        'FIN', 'Financial management and budgeting',     '2020-01-01'),
        ('d3333333-0000-0000-0000-000000000003', 'Administration', 'ADM', 'Administrative operations',             '2020-01-01'),
        ('d4444444-0000-0000-0000-000000000004', 'Human Resources','HR',  'HR and personnel management',           '2020-01-01'),
        ('d5555555-0000-0000-0000-000000000005', 'Planning',       'PLN', 'Strategic planning and development',    '2020-01-01'),
        ('d6666666-0000-0000-0000-000000000006', 'Procurement',    'PRO', 'Procurement and supply chain',          '2021-03-10')
      ON CONFLICT (id) DO NOTHING
      RETURNING id, name
    `);
    logger.info(`Inserted ${depts.rowCount} departments`);

    // Resolve dept name → id helper
    const deptIds: Record<string, string> = {
      ICT:               "d1111111-0000-0000-0000-000000000001",
      Finance:           "d2222222-0000-0000-0000-000000000002",
      Administration:    "d3333333-0000-0000-0000-000000000003",
      "Human Resources": "d4444444-0000-0000-0000-000000000004",
      Planning:          "d5555555-0000-0000-0000-000000000005",
      Procurement:       "d6666666-0000-0000-0000-000000000006",
    };

    // ─── Admin user ───────────────────────────────────────────────────────────
    const adminHash = await bcrypt.hash("admin1234", 12);
    await client.query(`
      INSERT INTO users (id, name, email, password_hash, department_id, role, is_admin, created_at)
      VALUES (
        'a0000000-0000-0000-0000-000000000000',
        'System Admin',
        'admin@district.rw',
        $1,
        $2,
        'Administrator',
        TRUE,
        '2020-01-01'
      ) ON CONFLICT (id) DO NOTHING`,
      [adminHash, deptIds["ICT"]]
    );

    // ─── Staff users ──────────────────────────────────────────────────────────
    const defaultPassword = await bcrypt.hash("password123", 12);
    const usersData = [
      { id: "aa100000-0000-0000-0000-000000000001", name: "Alice Uwimana",    email: "alice@district.rw",  dept: "ICT",              role: "Staff",      created: "2023-01-15" },
      { id: "aa200000-0000-0000-0000-000000000002", name: "Bob Ndayishimiye", email: "bob@district.rw",    dept: "Finance",          role: "Staff",      created: "2023-02-20" },
      { id: "aa300000-0000-0000-0000-000000000003", name: "Claire Mukamana",  email: "claire@district.rw", dept: "Administration",   role: "Manager",    created: "2022-11-10" },
      { id: "aa400000-0000-0000-0000-000000000004", name: "David Habimana",   email: "david@district.rw",  dept: "Human Resources",  role: "Staff",      created: "2023-04-01" },
      { id: "aa500000-0000-0000-0000-000000000005", name: "Eva Ingabire",     email: "eva@district.rw",    dept: "Planning",         role: "Analyst",    created: "2023-06-15" },
      { id: "aa600000-0000-0000-0000-000000000006", name: "Frank Nkurunziza", email: "frank@district.rw",  dept: "ICT",              role: "Technician", created: "2022-09-01" },
      { id: "aa700000-0000-0000-0000-000000000007", name: "Grace Uwase",      email: "grace@district.rw",  dept: "Finance",          role: "Manager",    created: "2022-07-20" },
      { id: "aa800000-0000-0000-0000-000000000008", name: "Henri Bizimana",   email: "henri@district.rw",  dept: "Administration",   role: "Staff",      created: "2024-01-08" },
    ];

    for (const u of usersData) {
      await client.query(`
        INSERT INTO users (id, name, email, password_hash, department_id, role, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING`,
        [u.id, u.name, u.email, defaultPassword, deptIds[u.dept], u.role, u.created]
      );
    }
    logger.info(`Inserted ${usersData.length} staff users`);

    // ─── Equipment ────────────────────────────────────────────────────────────
    const u1 = "aa100000-0000-0000-0000-000000000001";
    const u2 = "aa200000-0000-0000-0000-000000000002";
    const u3 = "aa300000-0000-0000-0000-000000000003";
    const u4 = "aa400000-0000-0000-0000-000000000004";
    const u5 = "aa500000-0000-0000-0000-000000000005";
    const u6 = "aa600000-0000-0000-0000-000000000006";

    const equipment = [
      { id: "eb100000-0000-0000-0000-000000000001", name: "Dell Latitude 5520",          category: "Laptop",     serial: "SN-DL5520-001", tag: "TAG-001", assignedTo: u1,   status: "assigned",    purchaseDate: "2022-03-15", condition: "excellent" },
      { id: "eb200000-0000-0000-0000-000000000002", name: "HP EliteBook 840 G8",         category: "Laptop",     serial: "SN-HP840-002",  tag: "TAG-002", assignedTo: u1,   status: "assigned",    purchaseDate: "2022-06-01", condition: "good"      },
      { id: "eb300000-0000-0000-0000-000000000003", name: "Lenovo ThinkPad X1 Carbon",   category: "Laptop",     serial: "SN-LTP-003",    tag: "TAG-003", assignedTo: u2,   status: "assigned",    purchaseDate: "2021-11-20", condition: "good"      },
      { id: "eb400000-0000-0000-0000-000000000004", name: 'Apple MacBook Pro 14"',       category: "Laptop",     serial: "SN-MBP-004",    tag: "TAG-004", assignedTo: u3,   status: "assigned",    purchaseDate: "2023-02-10", condition: "excellent" },
      { id: "eb500000-0000-0000-0000-000000000005", name: "Canon imageRUNNER MF644",     category: "Printer",    serial: "SN-CP644-005",  tag: "TAG-005", assignedTo: u3,   status: "assigned",    purchaseDate: "2021-08-05", condition: "fair"      },
      { id: "eb600000-0000-0000-0000-000000000006", name: 'Samsung 27" UHD Monitor',     category: "Monitor",    serial: "SN-SM27-006",   tag: "TAG-006", assignedTo: u4,   status: "assigned",    purchaseDate: "2022-09-12", condition: "excellent" },
      { id: "eb700000-0000-0000-0000-000000000007", name: "Logitech MX Keys Keyboard",   category: "Peripheral", serial: "SN-LMX-007",    tag: "TAG-007", assignedTo: u4,   status: "assigned",    purchaseDate: "2023-01-20", condition: "excellent" },
      { id: "eb800000-0000-0000-0000-000000000008", name: "Cisco IP Phone 8845",         category: "Phone",      serial: "SN-CISCO-008",  tag: "TAG-008", assignedTo: u5,   status: "assigned",    purchaseDate: "2021-05-30", condition: "good"      },
      { id: "eb900000-0000-0000-0000-000000000009", name: "HP LaserJet Pro M404n",       category: "Printer",    serial: "SN-HP404-009",  tag: "TAG-009", assignedTo: null, status: "available",   purchaseDate: "2022-04-22", condition: "good"      },
      { id: "eba00000-0000-0000-0000-00000000000a", name: 'Dell UltraSharp 24" Monitor', category: "Monitor",    serial: "SN-DU24-010",   tag: "TAG-010", assignedTo: null, status: "available",   purchaseDate: "2023-07-11", condition: "excellent" },
      { id: "ebb00000-0000-0000-0000-00000000000b", name: "Asus ProArt PA278QV",         category: "Monitor",    serial: "SN-ASUS-011",   tag: "TAG-011", assignedTo: null, status: "maintenance", purchaseDate: "2021-12-01", condition: "fair"      },
      { id: "ebc00000-0000-0000-0000-00000000000c", name: "Lenovo ThinkCentre M720",     category: "Desktop",    serial: "SN-LTC-012",    tag: "TAG-012", assignedTo: u6,   status: "assigned",    purchaseDate: "2021-10-15", condition: "good"      },
    ];

    for (const e of equipment) {
      await client.query(`
        INSERT INTO equipment
          (id, name, category, serial_number, tag_number, assigned_to, status, condition, purchase_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (id) DO NOTHING`,
        [e.id, e.name, e.category, e.serial, e.tag, e.assignedTo, e.status, e.condition, e.purchaseDate]
      );
    }
    logger.info(`Inserted ${equipment.length} equipment items`);

    // ─── Handovers ────────────────────────────────────────────────────────────
    const handovers = [
      { id: "ac100000-0000-0000-0000-000000000001", fromUser: u1,   toUser: u2,   eq: "eb100000-0000-0000-0000-000000000001", date: "2025-03-10", type: "reassign",  notes: "User transferred to Finance dept" },
      { id: "ac200000-0000-0000-0000-000000000002", fromUser: u3,   toUser: u4,   eq: "eb400000-0000-0000-0000-000000000004", date: "2025-04-01", type: "reassign",  notes: "Upgrade equipment reallocation" },
      { id: "ac300000-0000-0000-0000-000000000003", fromUser: u6,   toUser: null, eq: "ebc00000-0000-0000-0000-00000000000c", date: "2025-06-15", type: "reassign",  notes: null },
      { id: "ac400000-0000-0000-0000-000000000004", fromUser: u2,   toUser: u5,   eq: "eb300000-0000-0000-0000-000000000003", date: "2025-09-20", type: "reassign",  notes: "Project team reassignment" },
      { id: "ac500000-0000-0000-0000-000000000005", fromUser: null, toUser: u1,   eq: "eb800000-0000-0000-0000-000000000008", date: "2026-01-05", type: "new_issue", notes: null },
      { id: "ac600000-0000-0000-0000-000000000006", fromUser: u4,   toUser: null, eq: "eb700000-0000-0000-0000-000000000007", date: "2026-03-12", type: "return",    notes: "Returned to logistics" },
    ];

    for (const h of handovers) {
      await client.query(`
        INSERT INTO handovers
          (id, from_user_id, to_user_id, equipment_id, date, status, activity_type, notes)
        VALUES ($1,$2,$3,$4,$5,'completed',$6,$7)
        ON CONFLICT (id) DO NOTHING`,
        [h.id, h.fromUser, h.toUser, h.eq, h.date, h.type, h.notes]
      );
    }
    logger.info(`Inserted ${handovers.length} handovers`);

    await client.query("COMMIT");
    logger.info("✅ Seed complete");
    logger.info("   Admin login → email: admin@district.rw  / password: admin1234");
    logger.info("   Staff login → email: alice@district.rw  / password: password123");
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error("Seed failed", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();