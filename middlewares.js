/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 * @typedef {import('express').NextFunction} NextFunction
 * @typedef {(req: Request, res: Response, next: NextFunction) => void} ExpressMiddleware
 */

const fs = require('fs');
const path = require('path');
const mime = require('mime');
const uuid = require('uuid');
const multer = require('multer');

/**
 * Memory storage
 *
 * @returns {multer.Multer}
 */
const memoryStorage = multer({ storage: multer.memoryStorage() });

/**
 * Disk storage
 *
 * @param {string} destination
 * @param {string} fileName
 * @returns {multer.Multer}
 */
const diskStorage = (destination = '/', fileName) => {
  let cleanDestination = path.posix.normalize(destination);

  if (!cleanDestination.startsWith('/')) {
    cleanDestination = '/' + cleanDestination;
  }

  if (cleanDestination.length > 1 && cleanDestination.endsWith('/')) {
    cleanDestination = cleanDestination.slice(0, -1);
  }

  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const target = path.join('storage', destination);

        if (!fs.existsSync(target)) {
          fs.mkdirSync(target, { recursive: true });
        }

        cb(null, target);
      },
      filename: (req, file, cb) => {
        const ext = mime.getExtension(file.mimetype);
        const name = typeof fileName !== 'undefined' ? fileName : uuid.v4();

        cb(null, `${name}.${ext}`);
      },
    }),
  });
};

/**
 * Save to disk
 *
 * @param {string} destination
 * @returns {ExpressMiddleware}
 */
const saveToDisk = (destination = '/') => {
  return async (req, res, next) => {
    let cleanDestination = path.posix.normalize(destination);

    if (!cleanDestination.startsWith('/')) {
      cleanDestination = '/' + cleanDestination;
    }

    if (cleanDestination.length > 1 && cleanDestination.endsWith('/')) {
      cleanDestination = cleanDestination.slice(0, -1);
    }

    const target = path.join(process.env.STORAGE_PATH, cleanDestination);

    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }

    if (req.files) {
      const fileSavePromises = req.files.map(async (file, index) => {
        const filename = `${uuid.v4()}.${file.ext}`;
        const newFilePath = path.join(target, filename);

        await fs.promises.writeFile(newFilePath, file.buffer);
        req.files[index].path = newFilePath.replace(/\\/g, '/');
      });

      await Promise.all(fileSavePromises);
    } else if (req.file) {
      const filename = `${uuid.v4()}.${req.file.ext}`;
      const newFile = `${target}/${filename}`;

      await fs.promises.writeFile(newFile, req.file.buffer);
      req.file.path = '/' + newFile.replace(/\\/g, '/');
    }

    return next();
  };
};


module.exports = { memoryStorage, diskStorage, saveToDisk };
