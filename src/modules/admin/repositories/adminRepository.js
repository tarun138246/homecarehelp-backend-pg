const prisma = require('../../../common/prismaClient');

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