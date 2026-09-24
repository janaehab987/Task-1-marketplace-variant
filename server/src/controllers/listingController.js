import Joi from 'joi';
import { Listing } from '../models/Listing.js';

const createSchema = Joi.object({
  title: Joi.string().trim().min(1).required(),
  description: Joi.string().trim().allow('').optional(),
  price: Joi.number().min(0).required(),
  category: Joi.string().valid('textbooks', 'electronics', 'furniture', 'clothing', 'other').default('other'),
  condition: Joi.string().valid('new', 'like-new', 'used', 'worn').default('used'),
  status: Joi.string().valid('active', 'sold', 'removed').default('active'),
  seller: Joi.string().hex().length(24).optional()
});

const updateSchema = Joi.object({
  title: Joi.string().trim().min(1),
  description: Joi.string().trim().allow(''),
  price: Joi.number().min(0),
  category: Joi.string().valid('textbooks', 'electronics', 'furniture', 'clothing', 'other'),
  condition: Joi.string().valid('new', 'like-new', 'used', 'worn'),
  status: Joi.string().valid('active', 'sold', 'removed'),
  seller: Joi.string().hex().length(24)
}).min(1);

// GET /api/listings
export async function getAllListings(req, res, next) {
  try {
    const includeRemoved = req.query.includeRemoved === 'true' || req.query.includeRemoved === '1';
    const filter = includeRemoved ? {} : { status: { $ne: 'removed' } };

    const listings = await Listing.find(filter)
      .populate('seller', 'name email')
      .sort({ createdAt: -1 });

    res.json({ listings });
  } catch (err) { next(err); }
}

// GET /api/listings/:id
export async function getListing(req, res, next) {
  try {
    const includeRemoved = req.query.includeRemoved === 'true' || req.query.includeRemoved === '1';
    const listing = await Listing.findById(req.params.id).populate('seller', 'name email');

    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.status === 'removed' && !includeRemoved) {
      return res.status(404).json({ message: 'Listing not found' });
    }

    res.json({ listing });
  } catch (err) { next(err); }
}

// POST /api/listings
export async function createListing(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const listing = await Listing.create(value);
    const populated = await Listing.findById(listing._id).populate('seller', 'name email');
    res.status(201).json({ listing: populated });
  } catch (err) { next(err); }
}

// PATCH /api/listings/:id
export async function updateListing(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const existing = await Listing.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Listing not found' });
    if (existing.status === 'removed' && req.query.includeRemoved !== 'true' && req.query.includeRemoved !== '1') {
      return res.status(404).json({ message: 'Listing not found' });
    }

    const updated = await Listing.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    ).populate('seller', 'name email');

    res.json({ listing: updated });
  } catch (err) { next(err); }
}

// PATCH /api/listings/:id/sold
export async function markListingAsSold(req, res, next) {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.status === 'removed') {
      return res.status(400).json({ message: 'Removed listings cannot be marked as sold' });
    }

    listing.status = 'sold';
    await listing.save();

    await listing.populate('seller', 'name email');
    res.json({ message: 'Listing marked as sold', listing });
  } catch (err) { next(err); }
}

// DELETE /api/listings/:id
export async function deleteListing(req, res, next) {
  try {
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'removed' } },
      { new: true, runValidators: true }
    ).populate('seller', 'name email');

    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    res.json({
      message: 'Listing marked as removed',
      listing
    });
  } catch (err) { next(err); }
}
