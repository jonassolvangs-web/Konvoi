import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.chatMessage.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.callRecord.deleteMany();
  await prisma.filterSubscription.deleteMany();
  await prisma.cleaningHistory.deleteMany();
  await prisma.workOrderUnit.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.dwellingUnit.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.serviceProduct.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();

  // ─── Users ──────────────────────────────────────

  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Admin Turbo',
      email: 'admin@turbo.no',
      phone: '90000001',
      passwordHash,
      roles: JSON.stringify(['ADMIN', 'MOTEBOOKER', 'FELTSELGER', 'TEKNIKER']),
      activeRole: 'ADMIN',
    },
  });

  const mari = await prisma.user.create({
    data: {
      name: 'Mari Hansen',
      email: 'mari@turbo.no',
      phone: '90000002',
      passwordHash,
      roles: JSON.stringify(['MOTEBOOKER']),
      activeRole: 'MOTEBOOKER',
    },
  });

  const erik = await prisma.user.create({
    data: {
      name: 'Erik Nilsen',
      email: 'erik@turbo.no',
      phone: '90000003',
      passwordHash,
      roles: JSON.stringify(['FELTSELGER', 'MOTEBOOKER']),
      activeRole: 'FELTSELGER',
    },
  });

  const lars = await prisma.user.create({
    data: {
      name: 'Lars Berg',
      email: 'lars@turbo.no',
      phone: '90000004',
      passwordHash,
      roles: JSON.stringify(['TEKNIKER']),
      activeRole: 'TEKNIKER',
    },
  });

  const jonas = await prisma.user.create({
    data: {
      name: 'Jonas Dahl',
      email: 'jonas@turbo.no',
      phone: '90000005',
      passwordHash,
      roles: JSON.stringify(['FELTSELGER', 'TEKNIKER']),
      activeRole: 'FELTSELGER',
    },
  });

  console.log('Created 5 users');

  // ─── Service Products ───────────────────────────

  const products = await Promise.all([
    prisma.serviceProduct.create({ data: { name: 'Ventilasjonsrens Standard', price: 3990 } }),
    prisma.serviceProduct.create({ data: { name: 'Ventilasjonsrens Stor', price: 4990 } }),
    prisma.serviceProduct.create({ data: { name: 'Ventilasjonsrens Premium', price: 5990 } }),
    prisma.serviceProduct.create({ data: { name: 'Service Standard', price: 1990 } }),
    prisma.serviceProduct.create({ data: { name: 'Service Pluss', price: 2990 } }),
    prisma.serviceProduct.create({ data: { name: 'Filterbytte', price: 990 } }),
  ]);

  console.log('Created service products');

  // ─── Organizations (50 Oslo addresses) ──────────

  const orgs = [
    { name: 'Majorstuen Borettslag', address: 'Bogstadveien 15', postalCode: '0355', city: 'Oslo', lat: 59.9283, lon: 10.7125, numUnits: 48, buildingYear: 1935, chairmanName: 'Kari Nordmann', chairmanPhone: '91234567', chairmanEmail: 'kari@majorstuen-brl.no', managementCompany: 'OBOS' },
    { name: 'Grunerlokka Sameie', address: 'Thorvald Meyers gate 30', postalCode: '0555', city: 'Oslo', lat: 59.9225, lon: 10.7590, numUnits: 32, buildingYear: 1890, chairmanName: 'Per Olsen', chairmanPhone: '91234568', chairmanEmail: 'per@grunerlokka-sameie.no', managementCompany: 'Usbl' },
    { name: 'Frogner Terrasse', address: 'Frognerveien 22', postalCode: '0263', city: 'Oslo', lat: 59.9198, lon: 10.7088, numUnits: 24, buildingYear: 1920, chairmanName: 'Anne Lund', chairmanPhone: '91234569', chairmanEmail: 'anne@frogner-terrasse.no', managementCompany: 'OBOS' },
    { name: 'Toyen Park Borettslag', address: 'Hagegata 10', postalCode: '0653', city: 'Oslo', lat: 59.9122, lon: 10.7710, numUnits: 56, buildingYear: 1960, chairmanName: 'Mohammed Ali', chairmanPhone: '91234570', chairmanEmail: 'mohammed@toyen-park.no', managementCompany: 'Boligbygg' },
    { name: 'St. Hanshaugen Sameie', address: 'Ullevalsveien 45', postalCode: '0171', city: 'Oslo', lat: 59.9270, lon: 10.7420, numUnits: 18, buildingYear: 1905, chairmanName: 'Lisa Eriksen', chairmanPhone: '91234571', chairmanEmail: 'lisa@sthanshaugen.no', managementCompany: 'Usbl' },
    { name: 'Sagene Borettslag', address: 'Arendalsgata 8', postalCode: '0463', city: 'Oslo', lat: 59.9350, lon: 10.7510, numUnits: 36, buildingYear: 1940, chairmanName: 'Thomas Bakke', chairmanPhone: '91234572', chairmanEmail: 'thomas@sagene-brl.no', managementCompany: 'OBOS' },
    { name: 'Nydalen Boligpark', address: 'Nydalsveien 28', postalCode: '0484', city: 'Oslo', lat: 59.9490, lon: 10.7660, numUnits: 72, buildingYear: 2008, chairmanName: 'Ingrid Holm', chairmanPhone: '91234573', chairmanEmail: 'ingrid@nydalen-bp.no', managementCompany: 'OBOS' },
    { name: 'Torshov Sameie', address: 'Sandakerveien 22', postalCode: '0473', city: 'Oslo', lat: 59.9390, lon: 10.7580, numUnits: 28, buildingYear: 1930, chairmanName: 'Bjorn Strand', chairmanPhone: '91234574', chairmanEmail: 'bjorn@torshov-sameie.no', managementCompany: 'Usbl' },
    { name: 'Uranienborg Terrasse', address: 'Uranienborg terrasse 5', postalCode: '0351', city: 'Oslo', lat: 59.9250, lon: 10.7200, numUnits: 16, buildingYear: 1910, chairmanName: 'Marte Vik', chairmanPhone: '91234575', chairmanEmail: 'marte@uranienborg.no', managementCompany: 'OBOS' },
    { name: 'Kampen Borettslag', address: 'Boegatten 12', postalCode: '0655', city: 'Oslo', lat: 59.9100, lon: 10.7780, numUnits: 40, buildingYear: 1890, chairmanName: 'Ola Berg', chairmanPhone: '91234576', chairmanEmail: 'ola@kampen-brl.no', managementCompany: 'Boligbygg' },
    { name: 'Sinsen Borettslag', address: 'Loftsveien 7', postalCode: '0584', city: 'Oslo', lat: 59.9440, lon: 10.7810, numUnits: 44, buildingYear: 1955, chairmanName: 'Hilde Kristiansen', chairmanPhone: '91234577', chairmanEmail: 'hilde@sinsen-brl.no', managementCompany: 'OBOS' },
    { name: 'Hasle Terrasse', address: 'Hasleveien 14', postalCode: '0571', city: 'Oslo', lat: 59.9310, lon: 10.7900, numUnits: 60, buildingYear: 2015, chairmanName: 'Andreas Solberg', chairmanPhone: '91234578', chairmanEmail: 'andreas@hasle-terrasse.no', managementCompany: 'Usbl' },
    { name: 'Ekeberg Borettslag', address: 'Kongsveien 50', postalCode: '0193', city: 'Oslo', lat: 59.8990, lon: 10.7760, numUnits: 20, buildingYear: 1950, chairmanName: 'Randi Haugen', chairmanPhone: '91234579', chairmanEmail: 'randi@ekeberg-brl.no', managementCompany: 'OBOS' },
    { name: 'Ullern Sameie', address: 'Ullernchausseen 100', postalCode: '0280', city: 'Oslo', lat: 59.9230, lon: 10.6540, numUnits: 14, buildingYear: 1965, chairmanName: 'Fredrik Larsen', chairmanPhone: '91234580', chairmanEmail: 'fredrik@ullern-sameie.no', managementCompany: 'OBOS' },
    { name: 'Skoyen Borettslag', address: 'Hoffsveien 10', postalCode: '0275', city: 'Oslo', lat: 59.9210, lon: 10.6780, numUnits: 30, buildingYear: 1970, chairmanName: 'Eva Johansen', chairmanPhone: '91234581', chairmanEmail: 'eva@skoyen-brl.no', managementCompany: 'Usbl' },
    { name: 'Bjerke Borettslag', address: 'Refstadveien 5', postalCode: '0586', city: 'Oslo', lat: 59.9450, lon: 10.8100, numUnits: 52, buildingYear: 1960, chairmanName: 'Harald Nygard', chairmanPhone: '91234582', chairmanEmail: 'harald@bjerke-brl.no', managementCompany: 'OBOS' },
    { name: 'Aker Brygge Sameie', address: 'Brynjulf Bulls plass 1', postalCode: '0250', city: 'Oslo', lat: 59.9080, lon: 10.7270, numUnits: 22, buildingYear: 1988, chairmanName: 'Silje Moen', chairmanPhone: '91234583', chairmanEmail: 'silje@akerbrygge.no', managementCompany: 'OBOS' },
    { name: 'Bjolsen Borettslag', address: 'Bjolsengata 18', postalCode: '0468', city: 'Oslo', lat: 59.9370, lon: 10.7470, numUnits: 34, buildingYear: 1925, chairmanName: 'Geir Pedersen', chairmanPhone: '91234584', chairmanEmail: 'geir@bjolsen-brl.no', managementCompany: 'Usbl' },
    { name: 'Lambertseter Borettslag', address: 'Lambertseterveien 15', postalCode: '1150', city: 'Oslo', lat: 59.8670, lon: 10.8090, numUnits: 64, buildingYear: 1955, chairmanName: 'Tone Hagen', chairmanPhone: '91234585', chairmanEmail: 'tone@lambertseter.no', managementCompany: 'OBOS' },
    { name: 'Manglerud Borettslag', address: 'Plogveien 20', postalCode: '0681', city: 'Oslo', lat: 59.8880, lon: 10.8120, numUnits: 46, buildingYear: 1965, chairmanName: 'Arild Kvam', chairmanPhone: '91234586', chairmanEmail: 'arild@manglerud-brl.no', managementCompany: 'OBOS' },
    { name: 'Tonsenhagen Sameie', address: 'Kapellveien 30', postalCode: '0487', city: 'Oslo', lat: 59.9550, lon: 10.7950, numUnits: 38, buildingYear: 1958, chairmanName: 'Bente Lie', chairmanPhone: '91234587', chairmanEmail: 'bente@tonsenhagen.no', managementCompany: 'Usbl' },
    { name: 'Grorud Borettslag', address: 'Grorudveien 55', postalCode: '0976', city: 'Oslo', lat: 59.9620, lon: 10.8780, numUnits: 80, buildingYear: 1970, chairmanName: 'Khalid Hussein', chairmanPhone: '91234588', chairmanEmail: 'khalid@grorud-brl.no', managementCompany: 'Boligbygg' },
    { name: 'Bryn Borettslag', address: 'Ostensjoviein 12', postalCode: '0661', city: 'Oslo', lat: 59.9060, lon: 10.8010, numUnits: 26, buildingYear: 1945, chairmanName: 'Trude Andersen', chairmanPhone: '91234589', chairmanEmail: 'trude@bryn-brl.no', managementCompany: 'OBOS' },
    { name: 'Holmlia Sameie', address: 'Holmlia sentervei 1', postalCode: '1255', city: 'Oslo', lat: 59.8350, lon: 10.8050, numUnits: 42, buildingYear: 1980, chairmanName: 'Fatima Khan', chairmanPhone: '91234590', chairmanEmail: 'fatima@holmlia-sameie.no', managementCompany: 'Usbl' },
    { name: 'Romsas Borettslag', address: 'Romsasvegen 10', postalCode: '0970', city: 'Oslo', lat: 59.9660, lon: 10.8520, numUnits: 70, buildingYear: 1975, chairmanName: 'Vidar Nilsen', chairmanPhone: '91234591', chairmanEmail: 'vidar@romsas-brl.no', managementCompany: 'Boligbygg' },
    { name: 'Stovner Sameie', address: 'Stovnerveien 20', postalCode: '0983', city: 'Oslo', lat: 59.9690, lon: 10.9220, numUnits: 36, buildingYear: 1978, chairmanName: 'Nina Bakken', chairmanPhone: '91234592', chairmanEmail: 'nina@stovner-sameie.no', managementCompany: 'OBOS' },
    { name: 'Oppsal Borettslag', address: 'Vetlandsveien 14', postalCode: '0671', city: 'Oslo', lat: 59.8850, lon: 10.8340, numUnits: 50, buildingYear: 1960, chairmanName: 'Knut Jensen', chairmanPhone: '91234593', chairmanEmail: 'knut@oppsal-brl.no', managementCompany: 'Usbl' },
    { name: 'Bekkelaget Sameie', address: 'Ekebergveien 200', postalCode: '1163', city: 'Oslo', lat: 59.8740, lon: 10.7680, numUnits: 16, buildingYear: 1940, chairmanName: 'Lise Roed', chairmanPhone: '91234594', chairmanEmail: 'lise@bekkelaget.no', managementCompany: 'OBOS' },
    { name: 'Nordstrand Borettslag', address: 'Nordstrandveien 50', postalCode: '1165', city: 'Oslo', lat: 59.8600, lon: 10.7850, numUnits: 28, buildingYear: 1935, chairmanName: 'Jon Tveit', chairmanPhone: '91234595', chairmanEmail: 'jon@nordstrand-brl.no', managementCompany: 'OBOS' },
    { name: 'Bygdoy Alle Sameie', address: 'Bygdoy Alle 60', postalCode: '0265', city: 'Oslo', lat: 59.9160, lon: 10.6980, numUnits: 12, buildingYear: 1900, chairmanName: 'Astrid Lund', chairmanPhone: '91234596', chairmanEmail: 'astrid@bygdoyalle.no', managementCompany: 'OBOS' },
    { name: 'Vika Borettslag', address: 'Munkedamsveien 30', postalCode: '0250', city: 'Oslo', lat: 59.9110, lon: 10.7310, numUnits: 20, buildingYear: 1995, chairmanName: 'Martin Dale', chairmanPhone: '91234597', chairmanEmail: 'martin@vika-brl.no', managementCompany: 'Usbl' },
    { name: 'Grefsen Terrasse', address: 'Grefsenveien 40', postalCode: '0488', city: 'Oslo', lat: 59.9520, lon: 10.7700, numUnits: 22, buildingYear: 1950, chairmanName: 'Siri Helgesen', chairmanPhone: '91234598', chairmanEmail: 'siri@grefsen-terrasse.no', managementCompany: 'OBOS' },
    { name: 'Kjelsas Borettslag', address: 'Kjelsasveien 18', postalCode: '0488', city: 'Oslo', lat: 59.9580, lon: 10.7710, numUnits: 30, buildingYear: 1945, chairmanName: 'Anders Kraft', chairmanPhone: '91234599', chairmanEmail: 'anders@kjelsas-brl.no', managementCompany: 'Usbl' },
    { name: 'Ensjoveien Sameie', address: 'Ensjoveien 34', postalCode: '0661', city: 'Oslo', lat: 59.9130, lon: 10.7920, numUnits: 44, buildingYear: 2018, chairmanName: 'Camilla Wold', chairmanPhone: '91234600', chairmanEmail: 'camilla@ensjoveien.no', managementCompany: 'OBOS' },
    { name: 'Lorenskog Sameie', address: 'Solheimveien 15', postalCode: '1470', city: 'Lorenskog', lat: 59.9340, lon: 10.9550, numUnits: 54, buildingYear: 2005, chairmanName: 'Ole Haug', chairmanPhone: '91234601', chairmanEmail: 'ole@lorenskog-sameie.no', managementCompany: 'Usbl' },
    { name: 'Ryen Borettslag', address: 'Ryensvingen 3', postalCode: '0680', city: 'Oslo', lat: 59.8940, lon: 10.8050, numUnits: 40, buildingYear: 1958, chairmanName: 'Marit Sve', chairmanPhone: '91234602', chairmanEmail: 'marit@ryen-brl.no', managementCompany: 'OBOS' },
    { name: 'Carl Berner Sameie', address: 'Trondheimsveien 120', postalCode: '0565', city: 'Oslo', lat: 59.9330, lon: 10.7740, numUnits: 26, buildingYear: 1920, chairmanName: 'Erik Dahl', chairmanPhone: '91234603', chairmanEmail: 'erik@carlberner.no', managementCompany: 'Boligbygg' },
    { name: 'Voyen Borettslag', address: 'Maridalsveien 205', postalCode: '0469', city: 'Oslo', lat: 59.9410, lon: 10.7540, numUnits: 18, buildingYear: 1948, chairmanName: 'Gunhild Nes', chairmanPhone: '91234604', chairmanEmail: 'gunhild@voyen-brl.no', managementCompany: 'Usbl' },
    { name: 'Lilleborg Sameie', address: 'Lilleborg gate 5', postalCode: '0460', city: 'Oslo', lat: 59.9360, lon: 10.7530, numUnits: 32, buildingYear: 1935, chairmanName: 'Stein Rabe', chairmanPhone: '91234605', chairmanEmail: 'stein@lilleborg.no', managementCompany: 'OBOS' },
    { name: 'Veitvet Borettslag', address: 'Veitvetveien 25', postalCode: '0596', city: 'Oslo', lat: 59.9570, lon: 10.8380, numUnits: 48, buildingYear: 1968, chairmanName: 'Sara Moe', chairmanPhone: '91234606', chairmanEmail: 'sara@veitvet-brl.no', managementCompany: 'Boligbygg' },
    { name: 'Skullerud Borettslag', address: 'Skullerudveien 10', postalCode: '0690', city: 'Oslo', lat: 59.8720, lon: 10.8290, numUnits: 56, buildingYear: 1975, chairmanName: 'Jan Morten', chairmanPhone: '91234607', chairmanEmail: 'jan@skullerud-brl.no', managementCompany: 'OBOS' },
    { name: 'Mortensrud Sameie', address: 'Mortensrudveien 8', postalCode: '1281', city: 'Oslo', lat: 59.8440, lon: 10.8210, numUnits: 38, buildingYear: 1985, chairmanName: 'Linda Aasen', chairmanPhone: '91234608', chairmanEmail: 'linda@mortensrud.no', managementCompany: 'Usbl' },
    { name: 'Lysaker Brygge Sameie', address: 'Lysaker Brygge 20', postalCode: '1363', city: 'Lysaker', lat: 59.9130, lon: 10.6380, numUnits: 30, buildingYear: 2012, chairmanName: 'Petter Haugli', chairmanPhone: '91234609', chairmanEmail: 'petter@lysakerbrygge.no', managementCompany: 'OBOS' },
    { name: 'Blindern Borettslag', address: 'Blindernveien 6', postalCode: '0361', city: 'Oslo', lat: 59.9400, lon: 10.7220, numUnits: 24, buildingYear: 1952, chairmanName: 'Dag Finne', chairmanPhone: '91234610', chairmanEmail: 'dag@blindern-brl.no', managementCompany: 'Usbl' },
    { name: 'Smestad Sameie', address: 'Smestadveien 30', postalCode: '0376', city: 'Oslo', lat: 59.9350, lon: 10.6890, numUnits: 16, buildingYear: 1938, chairmanName: 'Heidi Gran', chairmanPhone: '91234611', chairmanEmail: 'heidi@smestad.no', managementCompany: 'OBOS' },
    { name: 'Abildsoveien Borettslag', address: 'Abildsoveien 22', postalCode: '0580', city: 'Oslo', lat: 59.9420, lon: 10.7870, numUnits: 42, buildingYear: 1962, chairmanName: 'Vegard Lie', chairmanPhone: '91234612', chairmanEmail: 'vegard@abildsoveien.no', managementCompany: 'OBOS' },
    { name: 'Sondre Nordstrand Sameie', address: 'Lorenskog gate 5', postalCode: '1253', city: 'Oslo', lat: 59.8380, lon: 10.8100, numUnits: 60, buildingYear: 1982, chairmanName: 'Amina Omar', chairmanPhone: '91234613', chairmanEmail: 'amina@sondrenordstrand.no', managementCompany: 'Boligbygg' },
    { name: 'Furuset Borettslag', address: 'Furusetveien 15', postalCode: '1053', city: 'Oslo', lat: 59.9500, lon: 10.8750, numUnits: 66, buildingYear: 1972, chairmanName: 'Rune Aaberg', chairmanPhone: '91234614', chairmanEmail: 'rune@furuset-brl.no', managementCompany: 'OBOS' },
    { name: 'Kolsas Sameie', address: 'Kolsasveien 10', postalCode: '1352', city: 'Kolsas', lat: 59.9100, lon: 10.5020, numUnits: 20, buildingYear: 1998, chairmanName: 'Tove Sunde', chairmanPhone: '91234615', chairmanEmail: 'tove@kolsas.no', managementCompany: 'Usbl' },
    { name: 'Sofienberg Borettslag', address: 'Sofienberggata 15', postalCode: '0551', city: 'Oslo', lat: 59.9230, lon: 10.7650, numUnits: 22, buildingYear: 1885, chairmanName: 'Hugo Vang', chairmanPhone: '91234616', chairmanEmail: 'hugo@sofienberg-brl.no', managementCompany: 'OBOS' },
  ];

  // Calculate distances from office (Oslo sentrum: 59.9139, 10.7522)
  const officeLat = 59.9139;
  const officeLon = 10.7522;

  function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const createdOrgs = [];

  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i];
    const straightLine = haversine(officeLat, officeLon, org.lat, org.lon);
    const driveKm = Math.round(straightLine * 1.4 * 10) / 10;
    const driveMin = Math.round((driveKm / 40) * 60);

    // Vary statuses
    let status: any = 'ikke_tildelt';
    let assignedToId: string | null = null;

    if (i < 10) {
      status = 'tildelt';
      assignedToId = mari.id;
    } else if (i < 15) {
      status = 'mote_booket';
      assignedToId = mari.id;
    } else if (i < 18) {
      status = 'besok_pagaar';
      assignedToId = erik.id;
    } else if (i < 20) {
      status = 'venter_tekniker';
      assignedToId = erik.id;
    } else if (i < 23) {
      status = 'rens_pagaar';
      assignedToId = lars.id;
    } else if (i < 25) {
      status = 'fullfort';
      assignedToId = erik.id;
    }

    const created = await prisma.organization.create({
      data: {
        name: org.name,
        address: org.address,
        postalCode: org.postalCode,
        city: org.city,
        latitude: org.lat,
        longitude: org.lon,
        distanceFromOfficeKm: driveKm,
        distanceFromOfficeMin: driveMin,
        numUnits: org.numUnits,
        buildingYear: org.buildingYear,
        chairmanName: org.chairmanName,
        chairmanPhone: org.chairmanPhone,
        chairmanEmail: org.chairmanEmail,
        managementCompany: org.managementCompany,
        status,
        assignedToId,
      },
    });

    createdOrgs.push(created);
  }

  console.log(`Created ${createdOrgs.length} organizations`);

  // ─── Appointments ─────────────────────────────────

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 5);

  const apt1 = await prisma.appointment.create({
    data: {
      organizationId: createdOrgs[10].id,
      userId: erik.id,
      scheduledAt: new Date(today.setHours(10, 0, 0, 0)),
      endAt: new Date(today.setHours(11, 0, 0, 0)),
      status: 'planlagt',
    },
  });

  const apt2 = await prisma.appointment.create({
    data: {
      organizationId: createdOrgs[11].id,
      userId: erik.id,
      scheduledAt: new Date(tomorrow.setHours(14, 0, 0, 0)),
      endAt: new Date(tomorrow.setHours(15, 0, 0, 0)),
      status: 'planlagt',
    },
  });

  const apt3 = await prisma.appointment.create({
    data: {
      organizationId: createdOrgs[12].id,
      userId: jonas.id,
      scheduledAt: new Date(nextWeek.setHours(9, 0, 0, 0)),
      endAt: new Date(nextWeek.setHours(10, 30, 0, 0)),
      status: 'planlagt',
    },
  });

  console.log('Created appointments');

  // ─── Visits ───────────────────────────────────────

  const visit1 = await prisma.visit.create({
    data: {
      organizationId: createdOrgs[15].id,
      appointmentId: null,
      userId: erik.id,
      source: 'booking',
      status: 'pagaar',
      startedAt: new Date(),
      unitsSold: 3,
      totalRevenue: 11970,
    },
  });

  const visit2 = await prisma.visit.create({
    data: {
      organizationId: createdOrgs[16].id,
      userId: erik.id,
      source: 'dor_til_dor',
      status: 'fullfort',
      startedAt: new Date(Date.now() - 86400000),
      completedAt: new Date(Date.now() - 82800000),
      unitsSold: 5,
      totalRevenue: 19950,
    },
  });

  console.log('Created visits');

  // ─── Dwelling Units ───────────────────────────────

  // For visit1 org (besok_pagaar)
  for (let floor = 1; floor <= 3; floor++) {
    for (let unit = 1; unit <= 4; unit++) {
      const unitNum = `${floor}0${unit}`;
      const statuses: any[] = ['ikke_besokt', 'solgt', 'ikke_interessert', 'ikke_hjemme'];
      await prisma.dwellingUnit.create({
        data: {
          organizationId: createdOrgs[15].id,
          visitId: visit1.id,
          unitNumber: unitNum,
          floor,
          residentName: `Beboer ${unitNum}`,
          residentPhone: `4${floor}${unit}00000`,
          visitStatus: statuses[(floor + unit) % 4],
          orderType: (floor + unit) % 4 === 1 ? 'ventilasjonsrens' : null,
        },
      });
    }
  }

  // For visit2 org (fullfort)
  for (let floor = 1; floor <= 2; floor++) {
    for (let unit = 1; unit <= 5; unit++) {
      const unitNum = `${floor}0${unit}`;
      await prisma.dwellingUnit.create({
        data: {
          organizationId: createdOrgs[16].id,
          visitId: visit2.id,
          unitNumber: unitNum,
          floor,
          residentName: `Beboer ${unitNum}`,
          visitStatus: unit <= 3 ? 'solgt' : 'ikke_hjemme',
          orderType: unit <= 3 ? 'ventilasjonsrens' : null,
        },
      });
    }
  }

  console.log('Created dwelling units');

  // ─── Work Orders ──────────────────────────────────

  const wo1 = await prisma.workOrder.create({
    data: {
      organizationId: createdOrgs[20].id,
      technicianId: lars.id,
      scheduledAt: new Date(today.setHours(8, 0, 0, 0)),
      status: 'planlagt',
    },
  });

  const wo2 = await prisma.workOrder.create({
    data: {
      organizationId: createdOrgs[21].id,
      technicianId: lars.id,
      scheduledAt: new Date(today.setHours(13, 0, 0, 0)),
      status: 'pagaar',
      startedAt: new Date(),
    },
  });

  const wo3 = await prisma.workOrder.create({
    data: {
      organizationId: createdOrgs[22].id,
      technicianId: lars.id,
      scheduledAt: new Date(tomorrow.setHours(9, 0, 0, 0)),
      status: 'planlagt',
    },
  });

  // Create dwelling units + work order units for work orders
  const defaultChecklist = [
    { id: 1, label: 'Sjekk avtrekksventiler', checked: false },
    { id: 2, label: 'Sjekk tilluftventiler', checked: false },
    { id: 3, label: 'Ren kanaler', checked: false },
    { id: 4, label: 'Sjekk vifteenhet', checked: false },
    { id: 5, label: 'Bytt filter', checked: false },
    { id: 6, label: 'Sjekk lyd/vibrasjon', checked: false },
    { id: 7, label: 'Sjekk kondens/fukt', checked: false },
    { id: 8, label: 'Sjekk brannstopp', checked: false },
    { id: 9, label: 'Måling før/etter', checked: false },
    { id: 10, label: 'Dokumentasjon og bilder', checked: false },
  ];

  for (const wo of [wo1, wo2, wo3]) {
    const orgId = wo.organizationId;
    for (let i = 1; i <= 3; i++) {
      const du = await prisma.dwellingUnit.create({
        data: {
          organizationId: orgId,
          unitNumber: `${i}01`,
          floor: i,
          residentName: `Beboer ${i}01`,
          residentPhone: `900${i}0000`,
          visitStatus: 'solgt',
          orderType: 'ventilasjonsrens',
        },
      });

      await prisma.workOrderUnit.create({
        data: {
          workOrderId: wo.id,
          dwellingUnitId: du.id,
          productId: products[0].id,
          orderType: 'ventilasjonsrens',
          price: 3990,
          paymentMethod: i === 1 ? 'vipps' : i === 2 ? 'faktura' : 'betalingsplan',
          paymentStatus: wo.status === 'fullfort' ? 'betalt' : 'ikke_betalt',
          status: wo.status === 'fullfort' ? 'fullfort' : 'ikke_startet',
          checklist: JSON.stringify(defaultChecklist),
        },
      });
    }
  }

  console.log('Created work orders with units');

  // ─── Call Records ─────────────────────────────────

  const callResults: any[] = ['mote_booket', 'ikke_svar', 'ring_tilbake', 'nei'];
  for (let i = 0; i < 20; i++) {
    await prisma.callRecord.create({
      data: {
        organizationId: createdOrgs[i % createdOrgs.length].id,
        userId: mari.id,
        result: callResults[i % 4],
        notes: i % 3 === 0 ? 'Test notat for samtale' : null,
        callbackAt: callResults[i % 4] === 'ring_tilbake' ? new Date(Date.now() + 86400000 * (i + 1)) : null,
        duration: Math.floor(Math.random() * 300) + 30,
      },
    });
  }

  console.log('Created call records');

  // ─── Cleaning History (3-year reminders) ──────────

  const twoAndHalfYearsAgo = new Date();
  twoAndHalfYearsAgo.setFullYear(twoAndHalfYearsAgo.getFullYear() - 2);
  twoAndHalfYearsAgo.setMonth(twoAndHalfYearsAgo.getMonth() - 6);

  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

  // 2 sameier with rens 2.5 years ago
  for (const orgIdx of [23, 24]) {
    const nextCleaning = new Date(twoAndHalfYearsAgo);
    nextCleaning.setFullYear(nextCleaning.getFullYear() + 3);
    await prisma.cleaningHistory.create({
      data: {
        organizationId: createdOrgs[orgIdx].id,
        completedDate: twoAndHalfYearsAgo,
        nextCleaningDate: nextCleaning,
        reminderStatus: 'innen_6mnd',
        numUnitsCompleted: createdOrgs[orgIdx].numUnits || 20,
        totalRevenue: (createdOrgs[orgIdx].numUnits || 20) * 3990,
        avgAirImprovement: 35.5,
      },
    });
  }

  // 1 forfalt
  const nextCleaningOverdue = new Date(threeYearsAgo);
  nextCleaningOverdue.setFullYear(nextCleaningOverdue.getFullYear() + 3);
  await prisma.cleaningHistory.create({
    data: {
      organizationId: createdOrgs[25].id,
      completedDate: threeYearsAgo,
      nextCleaningDate: nextCleaningOverdue,
      reminderStatus: 'forfalt',
      numUnitsCompleted: 28,
      totalRevenue: 28 * 3990,
      avgAirImprovement: 42.0,
    },
  });

  console.log('Created cleaning histories');

  // ─── Chat Messages ────────────────────────────────

  // Direct messages
  const directChannelId = [mari.id, erik.id].sort().join('_');
  await prisma.chatMessage.create({
    data: {
      channelType: 'direct',
      channelId: directChannelId,
      senderId: mari.id,
      content: 'Hei Erik, kan du ta Majorstuen i morgen?',
    },
  });
  await prisma.chatMessage.create({
    data: {
      channelType: 'direct',
      channelId: directChannelId,
      senderId: erik.id,
      content: 'Ja, det passer fint! Jeg tar den kl 10.',
    },
  });

  // Organization chat
  await prisma.chatMessage.create({
    data: {
      channelType: 'organization',
      channelId: createdOrgs[15].id,
      senderId: mari.id,
      organizationId: createdOrgs[15].id,
      content: 'Møte booket med styreleder for Tøyen Park.',
      isSystem: true,
    },
  });
  await prisma.chatMessage.create({
    data: {
      channelType: 'organization',
      channelId: createdOrgs[15].id,
      senderId: erik.id,
      organizationId: createdOrgs[15].id,
      content: 'Besøk startet. 12 enheter å registrere.',
    },
  });
  await prisma.chatMessage.create({
    data: {
      channelType: 'organization',
      channelId: createdOrgs[15].id,
      senderId: lars.id,
      organizationId: createdOrgs[15].id,
      content: 'Tekniker tildelt for rens.',
      isSystem: true,
    },
  });

  console.log('Created chat messages');

  // ─── Filter Subscriptions ─────────────────────────

  const soldUnits = await prisma.dwellingUnit.findMany({
    where: { visitStatus: 'solgt', organizationId: createdOrgs[16].id },
    take: 2,
  });

  for (const unit of soldUnits) {
    await prisma.filterSubscription.create({
      data: {
        dwellingUnitId: unit.id,
        organizationId: unit.organizationId,
        months: 12,
        pricePerMonth: 129,
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 86400000),
      },
    });
  }

  console.log('Created filter subscriptions');

  // ─── Settings ─────────────────────────────────────

  const settings = [
    { key: 'office_address', value: 'Storgata 1, 0155 Oslo' },
    { key: 'office_lat', value: '59.9139' },
    { key: 'office_lon', value: '10.7522' },
    { key: 'company_name', value: 'Turbo AS' },
    { key: 'company_org_number', value: '912345678' },
    { key: 'company_phone', value: '22334455' },
    { key: 'company_email', value: 'post@turbo.no' },
    { key: 'cleaning_interval_years', value: '3' },
  ];

  for (const setting of settings) {
    await prisma.setting.create({ data: setting });
  }

  console.log('Created settings');

  // ─── Notifications ────────────────────────────────

  await prisma.notification.create({
    data: {
      userId: erik.id,
      title: 'Nytt besøk tildelt',
      message: 'Du har fått et nytt besøk hos Majorstuen Borettslag',
      type: 'info',
      linkUrl: '/feltselger/besok',
    },
  });

  await prisma.notification.create({
    data: {
      userId: lars.id,
      title: 'Nytt oppdrag',
      message: 'Du har fått et nytt renseoppdrag hos Nydalen Boligpark',
      type: 'info',
      linkUrl: '/tekniker/oppdrag',
    },
  });

  console.log('Created notifications');

  // ─── Availability ──────────────────────────────────

  // Erik (Feltselger): Mon-Fri 08:00-16:00
  for (let dow = 1; dow <= 5; dow++) {
    await prisma.availability.create({
      data: {
        userId: erik.id,
        dayOfWeek: dow,
        startTime: '08:00',
        endTime: '16:00',
      },
    });
  }

  // Lars (Tekniker): Mon-Fri 07:00-17:00
  for (let dow = 1; dow <= 5; dow++) {
    await prisma.availability.create({
      data: {
        userId: lars.id,
        dayOfWeek: dow,
        startTime: '07:00',
        endTime: '17:00',
      },
    });
  }

  console.log('Created availability templates');

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
