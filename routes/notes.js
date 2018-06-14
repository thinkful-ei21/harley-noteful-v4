'use strict';

const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');

const Note = require('../models/note');
const Folder = require('../models/folder');
const Tag = require('../models/tag');

const router = express.Router();
router.use('/', passport.authenticate('jwt', { session: false, failWithError: true }));

/* ========== GET/READ ALL ITEMS ========== */
router.get('/', (req, res, next) => {
  const { searchTerm, folderId, tagId } = req.query;
  const userId = req.user.id;

  let filter = {userId};

  if (searchTerm) {
    // filter.title = { $regex: searchTerm, $options: 'i' };

    // Mini-Challenge: Search both `title` and `content`
    const re = new RegExp(searchTerm, 'i');
    filter.$or = [{ 'title': re }, { 'content': re }];
  }


  if (folderId) {
    filter.folderId = folderId;
  }

  if (tagId) {
    filter.tags = tagId;
  }

  Note.find(filter)
    //.populate('tags')
    .sort({ updatedAt: 'desc' })
    .then(results => {
      res.json(results);
    })
    .catch(err => {
      next(err);
    });
});

/* ========== GET/READ A SINGLE ITEM ========== */
router.get('/:id', (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error('The `id` is not valid');
    err.status = 400;
    return next(err);
  }

  Note.findOne({ _id: id, userId })
    .populate('tags')
    .then(result => {
      if (result) {
        res.json(result);
      } else {
        next();
      }
    })
    .catch(err => {
      next(err);
    });
});

/* ========== POST/CREATE AN ITEM ========== */
router.post('/', (req, res, next) => {
  const { title, content, folderId, tags = [] } = req.body;
  const userId = req.user.id;

  /***** Never trust users - validate input *****/
  if (!title) {
    const err = new Error('Missing `title` in request body');
    err.status = 400;
    return next(err);
  }

  if (folderId && (!mongoose.Types.ObjectId.isValid(folderId))) {
    const err = new Error('The `folderId` is not valid');
    err.status = 400;
    return next(err);
  }

  if (tags) {
    if (!(tags instanceof Array)) {
      const err = new Error('The tags property must be an array');
      err.status = 400;
      return next(err);
    }
    tags.forEach((tag) => {
      if (!mongoose.Types.ObjectId.isValid(tag)) {
        const err = new Error('The tags `id` is not valid');
        err.status = 400;
        return next(err);
      }
    });
  }

  const folderCheck = new Promise((resolve, reject) => {
    if (folderId){
      return Folder.findById(folderId)
        .then(result => {
          if (result.userId.toString() !== userId) {
            const err = new Error('The `folderId` is not yours');
            err.status = 400;
            return reject(err);
          } else {
            return resolve();
          }
        });
    } else {
      return resolve();
    }
  });

  const tagCheck = new Promise((resolve, reject) => {
    if(tags) {
      return Tag.find({userId})
        .then(results => {
          const userTags = results.map(result => result.id);
          tags.forEach((tag) => {
            if (!userTags.includes(tag)) {
              console.log('tag conflict detected');
              const err = new Error('The tags `id` is not yours');
              err.status = 400;
              return reject(err);
            }
          });
          return resolve();
        });
    } else {
      return resolve();
    }
  });

  folderCheck
    .then(() => {
      return tagCheck;
    })
    .then(() => {
      const newNote = { title, content, folderId, tags, userId };

      return Note.create(newNote)
        .then(result => {
          res
            .location(`${req.originalUrl}/${result.id}`)
            .status(201)
            .json(result);
        });
    })
    .catch(err => {
      next(err);
    });

  
});

/* ========== PUT/UPDATE A SINGLE ITEM ========== */
router.put('/:id', (req, res, next) => {
  const { id } = req.params;
  const { title, content, folderId, tags = [] } = req.body;
  const userId = req.user.id;

  /***** Never trust users - validate input *****/
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error('The `id` is not valid');
    err.status = 400;
    return next(err);
  }

  if (title === '') {
    const err = new Error('Missing `title` in request body');
    err.status = 400;
    return next(err);
  }

  if (folderId && !mongoose.Types.ObjectId.isValid(folderId)) {
    const err = new Error('The `folderId` is not valid');
    err.status = 400;
    return next(err);
  }

  if (tags) {
    if (!(tags instanceof Array)) {
      const err = new Error('The tags property must be an array');
      err.status = 400;
      return next(err);
    }
    tags.forEach((tag) => {
      if (!mongoose.Types.ObjectId.isValid(tag)) {
        const err = new Error('The tags `id` is not valid');
        err.status = 400;
        return next(err);
      }
    });
  }

  const folderCheck = new Promise((resolve, reject) => {
    if (folderId){
      return Folder.findById(folderId)
        .then(result => {
          if (result.userId.toString() !== userId) {
            const err = new Error('The `folderId` is not yours');
            err.status = 400;
            return reject(err);
          } else {
            return resolve();
          }
        });
    } else {
      return resolve();
    }
  });

  const tagCheck = new Promise((resolve, reject) => {
    if(tags) {
      return Tag.find({userId})
        .then(results => {
          const userTags = results.map(result => result.id);
          tags.forEach((tag) => {
            if (!userTags.includes(tag)) {
              const err = new Error('The tags `id` is not yours');
              err.status = 400;
              return reject(err);
            }
          });
          return resolve();
        });
    } else {
      return resolve();
    }
  });

  folderCheck
    .then(() => {
      return tagCheck;
    })
    .then(() => {
      const updateNote = { title, content, folderId, tags };
      const filter = { _id: id, userId};

      return Note.findOneAndUpdate(filter, updateNote, { new: true })
        .then(result => {
          if (result) {
            res.json(result);
          } else {
            next();
          }
        });
    })
    .catch(err => {
      next(err);
    });
});

/* ========== DELETE/REMOVE A SINGLE ITEM ========== */
router.delete('/:id', (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.id;

  /***** Never trust users - validate input *****/
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error('The `id` is not valid');
    err.status = 400;
    return next(err);
  }

  Note.findOneAndRemove({_id: id, userId})
    .then(() => {
      res.sendStatus(204);
    })
    .catch(err => {
      next(err);
    });
});

module.exports = router;