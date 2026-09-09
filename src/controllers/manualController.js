const prisma = require('../utils/prisma');

async function createManual(req, res) {
  try {
    const { title, courseCode, price, stock } = req.body;

    if (!title || price == null || stock == null) {
      return res.status(400).json({ error: 'title, price, and stock are required' });
    }

    const imageURL = req.file ? req.file.path : null;
    const normalizedStock = Number(stock);

    if (!Number.isInteger(normalizedStock) || normalizedStock < 0) {
      return res.status(400).json({ error: 'stock must be a non-negative whole number' });
    }

    const manual = await prisma.manual.create({
      data: {
        title,
        courseCode: courseCode || null,
        imageURL,
        price: Number(price),
        stock: normalizedStock,
      },
    });

    return res.status(201).json(manual);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A manual with this title already exists' });
    }
    return res.status(500).json({ error: 'Failed to create manual' });
  }
}



async function getManuals(req, res) {
  try {
    // If optionalAuthenticate found an Admin, isAdmin is true. Otherwise false.
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin');

    const manuals = await prisma.manual.findMany({
      where: isAdmin ? {} : { isActive: true }, // The magic filter
      include: {
        _count: {
          select: { purchases: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(manuals);
  } catch (error) {
    console.error('getManuals error:', error);
    return res.status(500).json({ error: 'Failed to fetch manuals' });
  }
}

async function toggleManualStatus(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid manual id' });

    const existing = await prisma.manual.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Manual not found' });

    const updated = await prisma.manual.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    return res.json(updated);
  } catch (error) {
    console.error('toggleManualStatus error:', error);
    return res.status(500).json({ error: 'Failed to toggle manual status' });
  }
}



async function updateManual(req, res) {
  try {
    const id = Number(req.params.id);
    const { title, courseCode, price, stock, isActive } = req.body;

    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid manual id' });

    const currentManual = await prisma.manual.findUnique({ where: { id } });
    if (!currentManual) return res.status(404).json({ error: 'Manual not found' });

    const normalizedStock = stock !== undefined ? Number(stock) : currentManual.stock;
    if (!Number.isInteger(normalizedStock) || normalizedStock < 0) {
      return res.status(400).json({ error: 'stock must be a non-negative whole number' });
    }

    const updateData = {
      title: title || currentManual.title,
      courseCode: courseCode !== undefined ? courseCode : currentManual.courseCode,
      price: price !== undefined ? Number(price) : currentManual.price,
      stock: normalizedStock,
      isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : currentManual.isActive,
    };

    if (req.file) {
      updateData.imageURL = req.file.path; 
    }

    const updated = await prisma.manual.update({
      where: { id },
      data: updateData,
    });

    return res.json(updated);
  } catch (error) {
    console.error('updateManual error:', error);
    return res.status(500).json({ error: 'Failed to update manual' });
  }
}


async function deleteManual(req, res) {
  try {
    // 1. Convert to Number once at the very top
    const manualId = Number(req.params.id);
    
    if (Number.isNaN(manualId)) {
      return res.status(400).json({ error: 'Invalid manual id' });
    }

    // 2. Check if the manual exists using the converted Number
    const manual = await prisma.manual.findUnique({ 
      where: { id: manualId } 
    });
    
    if (!manual) return res.status(404).json({ error: 'Manual not found' });

    // 3. Delete linked purchases FIRST (to satisfy Foreign Key constraints)
    await prisma.purchase.deleteMany({ 
      where: { manualId: manualId } 
    });

    // 4. Delete the manual itself
    await prisma.manual.delete({ 
      where: { id: manualId } // 👈 This must be a Number!
    });

    return res.json({ message: 'Manual record deleted successfully' });
  } catch (error) {
    console.error('deleteManual error:', error);
    return res.status(500).json({ error: 'Failed to delete manual' });
  }
}

async function restockManual(req, res) {
  try {
    const manualId = Number(req.params.id);
    const amount = Number(req.body.amount ?? req.body.quantity ?? 1);

    if (Number.isNaN(manualId)) {
      return res.status(400).json({ error: 'Invalid manual id' });
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Restock amount must be a positive whole number' });
    }

    const manual = await prisma.manual.findUnique({ where: { id: manualId } });
    if (!manual) return res.status(404).json({ error: 'Manual not found' });

    const updated = await prisma.manual.update({
      where: { id: manualId },
      data: {
        stock: manual.stock + amount,
        isActive: true,
      },
    });

    return res.json({
      message: 'Manual restocked successfully',
      manual: updated,
    });
  } catch (error) {
    console.error('restockManual error:', error);
    return res.status(500).json({ error: 'Failed to restock manual' });
  }
}


module.exports = { 
  createManual,
   getManuals, 
   toggleManualStatus, 
   updateManual, 
   deleteManual,
   restockManual };
