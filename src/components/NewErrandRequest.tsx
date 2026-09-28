import React, { useState } from 'react';
import type { Messenger, ErrandType, Order } from '../types';
import { ERRAND_TYPE_LABELS, TRANSPORT_MODE_LABELS } from '../utils/whatsapp';
import { compressImage } from '../utils/imageCompressor';
import { LocationPickerModal } from './LocationPickerModal';
import { ZIM_MAJOR_CITIES } from '../utils/cities';
import {
  ArrowLeft,
  ShoppingBag,
  Store,
  Plus,
  Trash2,
  Upload,
  Calendar,
  DollarSign,
  FileText,
  MapPin,
  Check,
  ShieldCheck,
  Camera,
  Image as ImageIcon,
  Package,
  UserCheck,
  Globe2,
} from 'lucide-react';

interface NewErrandRequestProps {
  messenger: Messenger;
  onBack: () => void;
  onPreview: (orderPayload: {
    errand_type: ErrandType;
    orderer_name: string;
    orderer_whatsapp: string;
    parcel_description?: string | null;
    shop_name?: string | null;
    item_list?: string[];
    budget?: number | null;
    product_image_url?: string | null;
    pickup_address: string;
    pickup_lat: number;
    pickup_lng: number;
    pickup_contact_person?: string | null;
    delivery_address: string;
    delivery_lat: number;
    delivery_lng: number;
    delivery_contact_person?: string | null;
    scheduled_datetime: string;
    proposed_charge: number;
    notes?: string | null;
    messenger_id: string;
  }) => void;
}

export const NewErrandRequest: React.FC<NewErrandRequestProps> = ({
  messenger,
  onBack,
  onPreview,
}) => {
  const [errandType, setErrandType] = useState<ErrandType>('grocery');
  const [ordererName, setOrdererName] = useState('');
  const [ordererWhatsapp, setOrdererWhatsapp] = useState('');

  // Parcel / Items description
  const [parcelDescription, setParcelDescription] = useState('');

  // Shopping specific
  const [shopName, setShopName] = useState('');
  const [items, setItems] = useState<string[]>(['']);
  const [budget, setBudget] = useState<string>('');

  // Pickup details
  const [pickupAddress, setPickupAddress] = useState(messenger.area_name);
  const [pickupCoords, setPickupCoords] = useState<[number, number]>([
    messenger.centre_lat,
    messenger.centre_lng,
  ]);
  const [pickupContactPerson, setPickupContactPerson] = useState('');

  // Delivery / Drop-off details
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCoords, setDeliveryCoords] = useState<[number, number]>([
    messenger.centre_lat,
    messenger.centre_lng,
  ]);
  const [deliveryContactPerson, setDeliveryContactPerson] = useState('');

  // Modals for location picking
  const [pickingLocationFor, setPickingLocationFor] = useState<'pickup' | 'delivery' | null>(null);

  // Date & Time
  const [scheduledType, setScheduledType] = useState<'asap' | 'later'>('asap');
  const [customDateTime, setCustomDateTime] = useState('');

  // Pricing
  const [proposedCharge, setProposedCharge] = useState<string>('4.00');

  // Notes
  const [notes, setNotes] = useState('');

  // Image Upload
  const [productImage, setProductImage] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  // Helpful item management
  const handleAddItem = () => setItems([...items, '']);
  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };
  const handleItemChange = (index: number, val: string) => {
    const updated = [...items];
    updated[index] = val;
    setItems(updated);
  };

  // Image file change
  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const compressedBase64 = await compressImage(file, 900, 900, 0.75);
      setProductImage(compressedBase64);
    } catch (err) {
      console.error('Image compression error:', err);
      alert('Could not compress image. Please try another photo.');
    } finally {
      setIsCompressing(false);
    }
  };

  const isShoppingErrand = ['grocery', 'market_run', 'pharmacy', 'order_collection'].includes(
    errandType
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!ordererName.trim()) {
      alert('Please enter your name.');
      return;
    }
    if (!ordererWhatsapp.trim()) {
      alert('Please enter your WhatsApp phone number.');
      return;
    }
    if (!pickupAddress.trim()) {
      alert('Please specify a pickup or shop address.');
      return;
    }
    if (!deliveryAddress.trim()) {
      alert('Please specify a destination drop-off location.');
      return;
    }
    const chargeVal = parseFloat(proposedCharge);
    if (isNaN(chargeVal) || chargeVal <= 0) {
      alert('Please set a valid proposed charge in USD.');
      return;
    }

    const scheduledText =
      scheduledType === 'asap'
        ? `ASAP (Today, within 1-2 hours)`
        : customDateTime || `Today, Scheduled`;

    const cleanedItemList = items.map((i) => i.trim()).filter(Boolean);

    onPreview({
      errand_type: errandType,
      orderer_name: ordererName.trim(),
      orderer_whatsapp: ordererWhatsapp.trim(),
      parcel_description: parcelDescription.trim() || null,
      shop_name: shopName.trim() || null,
      item_list: cleanedItemList,
      budget: budget ? parseFloat(budget) : null,
      product_image_url: productImage,
      pickup_address: pickupAddress.trim(),
      pickup_lat: pickupCoords[0],
      pickup_lng: pickupCoords[1],
      pickup_contact_person: pickupContactPerson.trim() || null,
      delivery_address: deliveryAddress.trim(),
      delivery_lat: deliveryCoords[0],
      delivery_lng: deliveryCoords[1],
      delivery_contact_person: deliveryContactPerson.trim() || null,
      scheduled_datetime: scheduledText,
      proposed_charge: chargeVal,
      notes: notes.trim() || null,
      messenger_id: messenger.id,
    });
  };


  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button & Selected Runner Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Runners</span>
        </button>

        <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
          Step 1 of 3: Errand Details
        </span>
      </div>

      {/* Runner Summary Card */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src={messenger.photo_url}
            alt={messenger.name}
            className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Selected Runner:</span>
              <h4 className="font-bold text-slate-900 text-sm">{messenger.name}</h4>
            </div>
            <div className="text-xs text-slate-600 mt-0.5 flex items-center gap-2">
              <span>{TRANSPORT_MODE_LABELS[messenger.transport_mode]?.label}</span>
              <span>•</span>
              <span>{messenger.area_name}</span>
              <span>•</span>
              <span className="text-amber-600 font-bold">★{messenger.rating_avg.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">What do you need done?</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select the errand type to configure item lists, shops, or pickup points.
          </p>
        </div>

        {/* Errand Type Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {(Object.keys(ERRAND_TYPE_LABELS) as ErrandType[]).map((type) => {
            const info = ERRAND_TYPE_LABELS[type];
            const isSelected = errandType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setErrandType(type)}
                className={`p-3 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="text-2xl mb-1.5">{info.icon}</div>
                <div>
                  <div className={`text-xs font-bold ${isSelected ? 'text-emerald-900' : 'text-slate-800'}`}>
                    {info.label}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                    {info.desc}
                  </div>
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                    <Check className="w-3 h-3 stroke-3" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Section: Your Details (Guest Orderer) */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            1. Your Contact Details (Guest)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Your Full Name *
              </label>
              <input
                type="text"
                required
                value={ordererName}
                onChange={(e) => setOrdererName(e.target.value)}
                placeholder="e.g. Farai Nyoni"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Your WhatsApp Number *
              </label>
              <input
                type="tel"
                required
                value={ordererWhatsapp}
                onChange={(e) => setOrdererWhatsapp(e.target.value)}
                placeholder="e.g. +263 77 123 4567"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Section: Parcel / Errand Description */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              2. Parcel & Items to be Picked Up
            </h3>
            <span className="text-[10px] text-slate-400">What needs to be collected?</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Parcel / Items Description
            </label>
            <textarea
              rows={2}
              value={parcelDescription}
              onChange={(e) => setParcelDescription(e.target.value)}
              placeholder="e.g. Sealed medical package from clinic, or 2 boxes of vehicle spare parts, or bus parcel at Roadport ticket #8291, or hardware quotation request."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>
        </div>

        {/* Section: Store & Shopping List (If applicable) */}
        {isShoppingErrand && (
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              3. Store & Specific Items (Optional)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Shop / Hospital / Outlet Name
                </label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder={
                    errandType === 'market_run'
                      ? 'e.g. Mbare Musika Vegetable Shed'
                      : errandType === 'pharmacy'
                      ? 'e.g. Greenwood Pharmacy Avondale / Parirenyatwa'
                      : 'e.g. OK Mart / Halsteds / TM Pick n Pay'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estimated Goods Budget ($USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    step="0.5"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="e.g. 25.00"
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Dynamic Items list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-700">
                  Item List (What should the runner purchase or inspect?)
                </label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Item</span>
                </button>
              </div>

              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 w-5 text-right">
                      {index + 1}.
                    </span>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleItemChange(index, e.target.value)}
                      placeholder={
                        index === 0
                          ? 'e.g. 2kg Red Seal Sugar / Medication'
                          : index === 1
                          ? 'e.g. 2L Olivine Cooking Oil'
                          : 'e.g. 1 Loaf Proton Bread'
                      }
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
                    />
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Section: Locations & Assisted By Contacts */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {isShoppingErrand ? '4. Pickup & Drop-off Routing' : '3. Pickup & Drop-off Routing'}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Pickup Location & Assisted By */}
            <div className="space-y-3 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Location of Parcel Pickup *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setPickingLocationFor('pickup')}
                    className="text-[11px] text-emerald-700 hover:underline font-semibold flex items-center gap-1"
                  >
                    Pin on Map
                  </button>
                </div>

                {/* Quick Town Selection */}
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'custom') {
                      setPickupAddress('');
                    } else if (val) {
                      const found = ZIM_MAJOR_CITIES.find((c) => c.name === val);
                      if (found) {
                        setPickupAddress(`${found.name}, Zimbabwe`);
                        setPickupCoords([found.lat, found.lng]);
                      }
                    }
                  }}
                  className="w-full mb-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">-- Quick Select City / Town --</option>
                  <optgroup label="Major Metropolitan Cities">
                    {ZIM_MAJOR_CITIES.filter((c) => c.isMajorCity).map((c) => (
                      <option key={`pk-${c.id}`} value={c.name}>
                        📍 {c.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="All Towns & Regions">
                    {ZIM_MAJOR_CITIES.filter((c) => !c.isMajorCity).map((c) => (
                      <option key={`pk-${c.id}`} value={c.name}>
                        📍 {c.name}
                      </option>
                    ))}
                  </optgroup>
                  <option value="custom">✏️ Other (Custom Location)...</option>
                </select>

                <input
                  type="text"
                  required
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="e.g. TM Pick n Pay Avondale, or Roadport Bay 4"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Assisted by (at pickup location)</span>
                </label>
                <input
                  type="text"
                  value={pickupContactPerson}
                  onChange={(e) => setPickupContactPerson(e.target.value)}
                  placeholder="e.g. Tinashe Gumbo (+263 77 123 4567)"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-xs"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Person handing over parcel or staff contact at pickup.
                </span>
              </div>
            </div>

            {/* Drop-off Location & Assisted By */}
            <div className="space-y-3 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Drop-off Location *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setPickingLocationFor('delivery')}
                    className="text-[11px] text-emerald-700 hover:underline font-semibold flex items-center gap-1"
                  >
                    Pin on Map
                  </button>
                </div>

                {/* Quick Town Selection */}
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'custom') {
                      setDeliveryAddress('');
                    } else if (val) {
                      const found = ZIM_MAJOR_CITIES.find((c) => c.name === val);
                      if (found) {
                        setDeliveryAddress(`${found.name}, Zimbabwe`);
                        setDeliveryCoords([found.lat, found.lng]);
                      }
                    }
                  }}
                  className="w-full mb-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">-- Quick Select City / Town --</option>
                  <optgroup label="Major Metropolitan Cities">
                    {ZIM_MAJOR_CITIES.filter((c) => c.isMajorCity).map((c) => (
                      <option key={`dl-${c.id}`} value={c.name}>
                        📍 {c.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="All Towns & Regions">
                    {ZIM_MAJOR_CITIES.filter((c) => !c.isMajorCity).map((c) => (
                      <option key={`dl-${c.id}`} value={c.name}>
                        📍 {c.name}
                      </option>
                    ))}
                  </optgroup>
                  <option value="custom">✏️ Other (Custom Location)...</option>
                </select>

                <input
                  type="text"
                  required
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="e.g. 14 Natal Rd, Belgravia or House 204 Unit L"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Assisted by (at drop-off location)</span>
                </label>
                <input
                  type="text"
                  value={deliveryContactPerson}
                  onChange={(e) => setDeliveryContactPerson(e.target.value)}
                  placeholder="e.g. Mrs. Nyoni (+263 71 987 6543)"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-xs"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Recipient name and phone number receiving the delivery.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Photos (Product/Prescription/Parcel) */}

        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {isShoppingErrand ? '4. Photo or List Image (Optional)' : '3. Parcel / Item Photo (Optional)'}
            </h3>
            <span className="text-[11px] text-slate-400">Compressed automatically</span>
          </div>

          {productImage ? (
            <div className="relative w-36 h-36 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-sm">
              <img src={productImage} alt="Uploaded item" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setProductImage(null)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center text-xs hover:bg-rose-600 transition"
              >
                ✕
              </button>
            </div>
          ) : (
            <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-50 hover:bg-emerald-50/40 transition">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageFile}
                className="hidden"
                disabled={isCompressing}
              />
              <Camera className="w-6 h-6 text-slate-400 mb-1" />
              <span className="text-xs font-semibold text-slate-700">
                {isCompressing ? 'Compressing image...' : 'Tap to snap or upload item / handwritten list'}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                PNG, JPG or WebP. Saves runner time confirming exact brand!
              </span>
            </label>
          )}
        </div>

        {/* Section: Schedule & Proposed Runner Fee */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {isShoppingErrand ? '5. Timing & Runner Fee' : '4. Timing & Runner Fee'}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Timing */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                When do you need this?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScheduledType('asap')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                    scheduledType === 'asap'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  ⚡ ASAP Today
                </button>
                <button
                  type="button"
                  onClick={() => setScheduledType('later')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                    scheduledType === 'later'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  📅 Schedule Time
                </button>
              </div>

              {scheduledType === 'later' && (
                <input
                  type="text"
                  value={customDateTime}
                  onChange={(e) => setCustomDateTime(e.target.value)}
                  placeholder="e.g. Today 4:30 PM or Tomorrow morning"
                  className="mt-2 w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-xs"
                />
              )}
            </div>

            {/* Proposed Charge */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Proposed Runner Fee ($USD) *
                </label>
                <span className="text-[10px] text-slate-400 font-medium">Negotiable in-app</span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  step="0.50"
                  required
                  min="1"
                  value={proposedCharge}
                  onChange={(e) => setProposedCharge(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-slate-900"
                />
              </div>

              {/* Quick rate suggestions for Zim */}
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[10px] text-slate-400 font-medium">Quick rates:</span>
                {['2.50', '4.00', '6.00', '10.00'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setProposedCharge(val)}
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-emerald-100 text-[11px] font-semibold text-slate-700 transition"
                  >
                    ${val}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Special Instructions / Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Call when outside the gate, check receipt, or bring change for $20."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-xs"
            />
          </div>
        </div>

        {/* Submit CTA */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            Next: Review exact WhatsApp message before opening WhatsApp.
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition"
          >
            <span>Preview WhatsApp Message</span>
            <span>→</span>
          </button>
        </div>
      </form>

      {/* Location Picker Modal */}
      {pickingLocationFor && (
        <LocationPickerModal
          isOpen={true}
          onClose={() => setPickingLocationFor(null)}
          title={
            pickingLocationFor === 'pickup'
              ? 'Select Pickup / Store Location'
              : 'Select Drop-off / Delivery Address'
          }
          initialAddress={pickingLocationFor === 'pickup' ? pickupAddress : deliveryAddress}
          initialLat={
            pickingLocationFor === 'pickup' ? pickupCoords[0] : deliveryCoords[0]
          }
          initialLng={
            pickingLocationFor === 'pickup' ? pickupCoords[1] : deliveryCoords[1]
          }
          onSelect={(addr, lat, lng) => {
            if (pickingLocationFor === 'pickup') {
              setPickupAddress(addr);
              setPickupCoords([lat, lng]);
            } else {
              setDeliveryAddress(addr);
              setDeliveryCoords([lat, lng]);
            }
          }}
        />
      )}
    </div>
  );
};
