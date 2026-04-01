const prisma = require('../utils/prisma');

async function createManual(req, res) {
  try {
    const { title, courseCode, price } = req.body;

    if (!title || price == null) {
      return res.status(400).json({ error: 'title and price are required' });
    }

    const imageURL = req.file ? req.file.path : null;

    const manual = await prisma.manual.create({
      data: {
        title,
        courseCode: courseCode || null,
        imageURL,
        price: Number(price),
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

// // --- UPDATE MANUAL ---
// async function updateManual(req, res) {
//   try {
//     const id = Number(req.params.id);
//     const { title, courseCode, price, isActive } = req.body;

//     if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid manual id' });

//     // 1. Find the current manual to check for existing images
//     const currentManual = await prisma.manual.findUnique({ where: { id } });
//     if (!currentManual) return res.status(404).json({ error: 'Manual not found' });

//     // 2. Prepare update object (Partial updates allowed)
//     const updateData = {
//       title: title || currentManual.title,
//       courseCode: courseCode !== undefined ? courseCode : currentManual.courseCode,
//       price: price !== undefined ? Number(price) : currentManual.price,
//       // Handle "true"/"false" strings from FormData
//       isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : currentManual.isActive,
//     };

//     // 3. Handle New Image Upload
//     if (req.file) {
//       updateData.imageURL = `http://localhost:5000/uploads/${req.file.filename}`;

//       // Delete the OLD physical file if it exists
//       if (currentManual.imageURL) {
//         const oldFilename = currentManual.imageURL.split('/').pop();
//         const oldPath = path.join(__dirname, '../uploads', oldFilename);
        
//         if (fs.existsSync(oldPath)) {
//           fs.unlink(oldPath, (err) => {
//             if (err) console.error("Disk Cleanup Error (Update):", err);
//           });
//         }
//       }
//     }

//     const updated = await prisma.manual.update({
//       where: { id },
//       data: updateData,
//     });

//     return res.json(updated);
//   } catch (error) {
//     console.error('updateManual error:', error);
//     return res.status(500).json({ error: 'Failed to update manual' });
//   }
// }


async function updateManual(req, res) {
  try {
    const id = Number(req.params.id);
    const { title, courseCode, price, isActive } = req.body;

    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid manual id' });

    // 1. Check if the manual exists
    const currentManual = await prisma.manual.findUnique({ where: { id } });
    if (!currentManual) return res.status(404).json({ error: 'Manual not found' });

    // 2. Prepare update object
    const updateData = {
      title: title || currentManual.title,
      courseCode: courseCode !== undefined ? courseCode : currentManual.courseCode,
      price: price !== undefined ? Number(price) : currentManual.price,
      isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : currentManual.isActive,
    };

    // 3. Handle New Image Upload (The Cloudinary Way)
    if (req.file) {
      // Just take the new Cloudinary URL. 
      // You don't need 'fs' or 'path' anymore!
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

// // --- DELETE MANUAL ---
// async function deleteManual(req, res) {
//   try {
//     const id = Number(req.params.id);
//     if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid manual id' });

//     // 1. Find the manual to get the image path before deleting the record
//     const manual = await prisma.manual.findUnique({ where: { id } });
//     if (!manual) return res.status(404).json({ error: 'Manual not found' });

//     // 2. Delete the physical image file from the server
//     if (manual.imageURL) {
//       const filename = manual.imageURL.split('/').pop();
//       const filePath = path.join(__dirname, '../uploads', filename);
      
//       if (fs.existsSync(filePath)) {
//         fs.unlink(filePath, (err) => {
//           if (err) console.error("Disk Cleanup Error (Delete):", err);
//         });
//       }
//     }

//     // 3. Delete from database
//     await prisma.manual.delete({ where: { id } });

//     return res.json({ message: 'Manual and associated image deleted successfully' });
//   } catch (error) {
//     console.error('deleteManual error:', error);
//     return res.status(500).json({ error: 'Failed to delete manual' });
//   }
// }

// --- DELETE MANUAL ---
async function deleteManual(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid manual id' });

    // 1. Check if the manual exists
    const manual = await prisma.manual.findUnique({ where: { id } });
    if (!manual) return res.status(404).json({ error: 'Manual not found' });

    // 2. Delete from database
    // We don't need fs.unlink anymore because the image is on Cloudinary!
    await prisma.manual.delete({ where: { id } });

    return res.json({ message: 'Manual record deleted successfully' });
  } catch (error) {
    console.error('deleteManual error:', error);
    return res.status(500).json({ error: 'Failed to delete manual' });
  }
}

module.exports = { 
  createManual,
   getManuals, 
   toggleManualStatus, 
   updateManual, 
   deleteManual };
