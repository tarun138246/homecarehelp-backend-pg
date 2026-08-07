const prisma = require('../../../common/prismaClient');

// ------------------------------------------------------------
//  BOOKINGS
// ------------------------------------------------------------

exports.findAllBookings = () => {
  return prisma.bookings.findMany({
    select: {
      booking_id: true,
      total_amount: true,
      address: true,
      users: {
        select: {
          name: true,
          phone_number: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });
};

exports.findBookingById = (bookingId) => {
  return prisma.bookings.findUnique({
    where: { booking_id: BigInt(bookingId) },
    select: {
      booking_id: true,
      services_id: true,
      total_amount: true,
      address: true,
      scheduled_date: true,
      time_slot: true,
      payment_status: true,
      payment_details: true,
      status: true,
      created_at: true,
      users: {
        select: {
          name: true,
          phone_number: true,
          email: true,
        },
      },
    },
  });
};

/**
 * Fetch service details based on services_id array from booking
 * services_id format can be:
 * - Array of strings: ["service-id-1", "service-id-2"]
 * - Array of objects: [{ service_id: "...", quantity: 1, price: 100 }]
 */
exports.fetchServicesDetails = async (servicesIdData) => {
  if (!Array.isArray(servicesIdData) || servicesIdData.length === 0) {
    return [];
  }

  // Extract service IDs from the array (handle both string and object formats)
  const serviceIds = servicesIdData.map(item => {
    if (typeof item === 'string') {
      return item;
    } else if (typeof item === 'object' && item.service_id) {
      return item.service_id;
    }
    return null;
  }).filter(Boolean);

  if (serviceIds.length === 0) {
    return [];
  }

  // Fetch services from database
  const services = await prisma.services.findMany({
    where: {
      service_id: { in: serviceIds }
    },
    select: {
      service_id: true,
      service_name: true,
      base_price: true,
      min_price: true,
      price_per_sqft: true,
      pricing_type: true,
    }
  });

  // Create a map for quick lookup
  const serviceMap = {};
  services.forEach(service => {
    serviceMap[service.service_id] = service;
  });

  // Build the result array with service details
  return servicesIdData.map(item => {
    let serviceId, quantity, customPrice;

    if (typeof item === 'string') {
      serviceId = item;
      quantity = 1;
      customPrice = null;
    } else if (typeof item === 'object') {
      serviceId = item.service_id;
      quantity = item.quantity || 1;
      customPrice = item.price || null;
    }

    const serviceData = serviceMap[serviceId];

    if (!serviceData) {
      return {
        service_id: serviceId,
        service_name: 'Unknown Service',
        price: customPrice ? customPrice.toString() : '0',
        quantity: quantity,
        pricing_type: 'fixed'
      };
    }

    // Determine the price to display
    let displayPrice = customPrice;
    if (!displayPrice) {
      if (serviceData.base_price) {
        displayPrice = serviceData.base_price;
      } else if (serviceData.min_price) {
        displayPrice = serviceData.min_price;
      } else if (serviceData.price_per_sqft) {
        displayPrice = serviceData.price_per_sqft;
      } else {
        displayPrice = 0;
      }
    }

    return {
      service_id: serviceData.service_id,
      service_name: serviceData.service_name,
      price: displayPrice.toString(),
      quantity: quantity,
      pricing_type: serviceData.pricing_type,
    };
  });
};

// ------------------------------------------------------------
//  CATEGORIES
// ------------------------------------------------------------

exports.findAllCategories = () => {
  return prisma.service_categories.findMany({
    orderBy: { category_id: 'asc' },
    include: {
      _count: {
        select: { service_subcategories: true }
      }
    }
  });
};

exports.findCategoryById = (id) => {
  return prisma.service_categories.findUnique({
    where: { category_id: id }
  });
};

exports.findCategoryByName = (name) => {
  return prisma.service_categories.findFirst({
    where: { category_name: name }
  });
};

exports.createCategory = (data) => {
  return prisma.service_categories.create({
    data: {
      category_name: data.category_name,
    }
  });
};

exports.updateCategory = (id, data) => {
  return prisma.service_categories.update({
    where: { category_id: id },
    data: {
      category_name: data.category_name,
      updated_at: new Date()
    }
  });
};

exports.deleteCategory = (id) => {
  return prisma.service_categories.delete({
    where: { category_id: id }
  });
};

exports.getSubcategoriesByCategoryId = (categoryId) => {
  return prisma.service_subcategories.findMany({
    where: { category_id: categoryId },
    include: {
      _count: { select: { services: true } }
    }
  });
};

// ------------------------------------------------------------
//  SUBCATEGORIES
// ------------------------------------------------------------

exports.findAllSubcategories = () => {
  return prisma.service_subcategories.findMany({
    orderBy: { subcategory_id: 'asc' },
    include: {
      service_categories: {
        select: { category_id: true, category_name: true }
      },
      _count: {
        select: { services: true }
      }
    }
  });
};

exports.findSubcategoryById = (id) => {
  return prisma.service_subcategories.findUnique({
    where: { subcategory_id: id }
  });
};

exports.findSubcategoryByNameAndCategory = (name, categoryId) => {
  return prisma.service_subcategories.findFirst({
    where: {
      subcategory_name: name,
      category_id: categoryId
    }
  });
};

exports.createSubcategory = (data) => {
  return prisma.service_subcategories.create({
    data: {
      category_id: data.category_id,
      subcategory_name: data.subcategory_name,
    }
  });
};

exports.updateSubcategory = (id, data) => {
  return prisma.service_subcategories.update({
    where: { subcategory_id: id },
    data: {
      subcategory_name: data.subcategory_name,
      updated_at: new Date()
    }
  });
};

exports.deleteSubcategory = (id) => {
  return prisma.service_subcategories.delete({
    where: { subcategory_id: id }
  });
};

exports.getServiceCountBySubcategoryId = (subcategoryId) => {
  return prisma.services.count({
    where: { subcategory_id: subcategoryId }
  });
};

// ------------------------------------------------------------
//  SERVICES
// ------------------------------------------------------------

/**
 * List services with only id, name, and subcategory_id
 */
exports.findAllServices = () => {
  return prisma.services.findMany({
    select: {
      service_id: true,
      service_name: true,
      subcategory_id: true,
    },
    orderBy: { service_name: 'asc' },
  });
};

/**
 * Find a single service by its string ID
 */
exports.findServiceById = (serviceId) => {
  return prisma.services.findUnique({
    where: { service_id: serviceId },
  });
};

/**
 * Generate a unique service_id based on the service name.
 * Algorithm: first 5 alphanumeric chars of name (lowercased) + 4-digit random number.
 * Retry until a unique ID is found (max 10 attempts to avoid infinite loops).
 */
exports.generateServiceId = async (serviceName) => {
  const prefix = serviceName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')       // strip non-alphanumeric
    .slice(0, 5) || 'srv';           // fallback to 'srv' if empty

  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    const candidate = `${prefix}${suffix}`;

    const existing = await prisma.services.findUnique({
      where: { service_id: candidate },
      select: { service_id: true },
    });
    if (!existing) {
      return candidate;
    }
  }

  throw new Error('Unable to generate unique service ID after 10 attempts');
};

/**
 * Create a new service record
 */
exports.createService = (data) => {
  return prisma.services.create({ data });
};

/**
 * Update a service partially (only provided fields)
 */
exports.updateService = (serviceId, data) => {
  return prisma.services.update({
    where: { service_id: serviceId },
    data: {
      ...data,
      updated_at: new Date(),
    },
  });
};

/**
 * Delete a service by its string ID
 */
exports.deleteService = (serviceId) => {
  return prisma.services.delete({
    where: { service_id: serviceId },
  });
};
