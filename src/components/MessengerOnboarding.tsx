import React, { useState, useEffect } from 'react';
import type { Messenger, TransportMode } from '../types';
import { TRANSPORT_MODE_LABELS } from '../utils/whatsapp';
import { compressImage } from '../utils/imageCompressor';
import { LocationPickerModal } from './LocationPickerModal';
import { ZIM_MAJOR_CITIES } from '../utils/cities';
import { authClient } from '../lib/auth-client';
import { isShadowEmail, shadowEmailToPhone } from '../utils/phoneAuth';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ShieldCheck,
  Bike,
  Car,
  MapPin,
  FileCheck2,
  AlertCircle,
  Clock,
  UploadCloud,
  User,
} from 'lucide-react';

interface MessengerOnboardingProps {
  onBack: () => void;
  onRegistered: (newMessenger: Messenger) => void;
}

export const MessengerOnboarding: React.FC<MessengerOnboardingProps> = ({
  onBack,
  onRegistered,
}) => {
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [transportMode, setTransportMode] = useState<TransportMode>('motorbike');
  const [areaName, setAreaName] = useState('Harare CBD & Avenues');
  const [centreCoords, setCentreCoords] = useState<[number, number]>([-17.8292, 31.0522]);
  const [radiusKm, setRadiusKm] = useState<number>(6.0);
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [transportPhoto, setTransportPhoto] = useState<string>('');

  // Mandatory KYC: National ID Front & Back for ALL runners
  const [nationalIdFront, setNationalIdFront] = useState<string>('');
  const [nationalIdBack, setNationalIdBack] = useState<string>('');

  // Vehicle KYC: Driver's Licence Front & Back (Mandatory for motorbike/car, exempt for others)
  const [driverLicenceFront, setDriverLicenceFront] = useState<string>('');
  const [driverLicenceBack, setDriverLicenceBack] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pickingLocation, setPickingLocation] = useState(false);
  const [submittedRunner, setSubmittedRunner] = useState<Messenger | null>(null);

  const { data: session } = authClient.useSession();

  // Automatically pre-populate signed-in user's details
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'x-user-email': session?.user?.email || '' },
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.user) {
            if (data.user.name) setName(data.user.name);
            if (data.user.phone) {
              const clean = data.user.phone.replace(/[^\d+]/g, '');
              setWhatsapp(clean);
            }
            if (data.user.avatar_url && !photoUrl) {
              setPhotoUrl(data.user.avatar_url);
            }
          }
        }
      } catch (err) {
        console.warn('Pre-populate error:', err);
      }
    };

    if (session?.user) {
      if (session.user.name) {
        setName(session.user.name);
      }
      if (session.user.image) {
        setPhotoUrl(session.user.image);
      }
      if (session.user.email && isShadowEmail(session.user.email)) {
        const raw = shadowEmailToPhone(session.user.email).replace(/[^\d+]/g, '');
        setWhatsapp(raw);
      }
      fetchMe();
    }
  }, [session?.user]);

  const isVehicle = transportMode === 'motorbike' || transportMode === 'car';

  const handleProfilePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImage(file, 600, 600, 0.8);
      setPhotoUrl(compressed);
    }
  };

  const handleTransportPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImage(file, 800, 800, 0.8);
      setTransportPhoto(compressed);
    }
  };

  const handleIdUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 1000, 1000, 0.85);
        setter(compressed);
      } catch (err) {
        alert('Failed to upload image. Please try another image file.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return alert('Please enter your full name.');
    if (!whatsapp.trim()) return alert('Please enter your WhatsApp phone number.');

    // Validate National ID (Mandatory for ALL runners)
    if (!nationalIdFront || !nationalIdBack) {
      return alert(
        'National ID Card (both FRONT and BACK photos) is mandatory for runner onboarding KYC.'
      );
    }

    // Validate Driver's Licence (Mandatory for motorized vehicles)
    if (isVehicle && (!driverLicenceFront || !driverLicenceBack)) {
      return alert(
        "Driver's Licence (both FRONT and BACK photos) is mandatory for runners with motorbikes or cars."
      );
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/messengers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': session?.user?.email || '',
        },
        body: JSON.stringify({
          name: name.trim(),
          photo_url:
            photoUrl ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
          whatsapp_number: whatsapp.trim(),
          transport_mode: transportMode,
          transport_photo_urls: transportPhoto ? [transportPhoto] : [],
          area_name: areaName.trim(),
          centre_lat: centreCoords[0],
          centre_lng: centreCoords[1],
          radius_km: radiusKm,
          national_id_front: nationalIdFront,
          national_id_back: nationalIdBack,
          driver_licence_front: driverLicenceFront || null,
          driver_licence_back: driverLicenceBack || null,
          owner_email: session?.user?.email || 'comfort.designszw@gmail.com',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Registration failed');
      }

      const createdMessenger: Messenger = await res.json();
      setSubmittedRunner(createdMessenger);
    } catch (err: any) {
      console.error(err);
      alert('Error registering messenger: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // If successfully submitted, show verification pending confirmation screen
  if (submittedRunner) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border-2 border-amber-200">
            <Clock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
              KYC Under Admin Review
            </span>
            <h2 className="text-2xl font-black text-slate-900">
              Welcome, {submittedRunner.name}!
            </h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              Your profile and KYC verification documents have been submitted to the WhaRunner Verification Desk.
            </p>
          </div>

          {/* Verification checklist card */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left text-xs space-y-2.5">
            <div className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-2">
              Verification Status Checklist:
            </div>
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>National ID (Front & Back) uploaded</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>
                {isVehicle
                  ? "Driver's Licence (Front & Back) uploaded"
                  : "Exempted from Driver's Licence (" + TRANSPORT_MODE_LABELS[transportMode].label + ')'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-amber-800 font-semibold">
              <Clock className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Admin Verification: Pending (usually approved within a few hours)</span>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Once an admin reviews and verifies your documents, your runner card will automatically appear live across the Home section and in the Errand Ordering directory.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => onRegistered(submittedRunner)}
              className="flex-1 py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition"
            >
              Open Runner Dashboard
            </button>
            <button
              onClick={onBack}
              className="py-3 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
        <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
          Runner Onboarding & KYC
        </span>
      </div>

      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>Join as a Verified Runner</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Runner Profile & KYC Verification</h2>
          <p className="text-xs text-slate-500 mt-1">
            Create your profile and upload your National ID (and Driver's License if using a vehicle) for admin verification before receiving errand requests.
          </p>
        </div>

        {session?.user && (
          <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Account Linked: <strong>{session.user.name}</strong> ({session.user.email})
              </span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
              Autofilled
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile & Transport Photo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Profile Photo *
              </label>
              {photoUrl ? (
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-emerald-500">
                  <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotoUrl('')}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <label className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-500 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-50 transition p-2">
                  <Camera className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="text-[10px] font-medium text-slate-600">Add Photo</span>
                  <input type="file" accept="image/*" onChange={handleProfilePhoto} className="hidden" />
                </label>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Vehicle Photo (Optional)
              </label>
              {transportPhoto ? (
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-emerald-500">
                  <img src={transportPhoto} alt="Transport" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setTransportPhoto('')}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <label className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-500 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-50 transition p-2">
                  <Bike className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="text-[10px] font-medium text-slate-600">Transport Photo</span>
                  <input type="file" accept="image/*" onChange={handleTransportPhoto} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {/* Name & WhatsApp */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tendai Moyo"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                WhatsApp Phone Number *
              </label>
              <input
                type="tel"
                required
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="e.g. +263 77 123 4567"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Direct WhatsApp contact where errand handoffs and customer chats will occur.
              </span>
            </div>
          </div>

          {/* Transport Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Primary Mode of Transport *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(TRANSPORT_MODE_LABELS) as TransportMode[]).map((mode) => {
                const info = TRANSPORT_MODE_LABELS[mode];
                const isSelected = transportMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTransportMode(mode)}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-500'
                        : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xl">{info.icon}</span>
                    <span className="text-xs">{info.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION: MANDATORY KYC DOCUMENTS */}
          <div className="pt-4 border-t border-slate-200 space-y-4">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Mandatory KYC Verification Documents</h3>
                <p className="text-[11px] text-slate-500">
                  Uploaded documents are analyzed by admin to verify your identity.
                </p>
              </div>
            </div>

            {/* 1. National ID Card (Mandatory for ALL) */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-black">
                    1
                  </span>
                  National ID Card (Mandatory for all Runners)
                </span>
                <span className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-100 px-2 py-0.5 rounded-md">
                  Required
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* ID Front */}
                <div>
                  <span className="block text-[11px] font-semibold text-slate-600 mb-1">
                    National ID — Front Photo *
                  </span>
                  {nationalIdFront ? (
                    <div className="relative h-32 rounded-xl overflow-hidden border-2 border-emerald-500 bg-white">
                      <img
                        src={nationalIdFront}
                        alt="ID Front"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setNationalIdFront('')}
                        className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-bold"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <label className="h-32 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-500 flex flex-col items-center justify-center text-center cursor-pointer bg-white transition p-3">
                      <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="text-xs font-semibold text-slate-700">Upload ID Front</span>
                      <span className="text-[10px] text-slate-400">Clear readable photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleIdUpload(e, setNationalIdFront)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* ID Back */}
                <div>
                  <span className="block text-[11px] font-semibold text-slate-600 mb-1">
                    National ID — Back Photo *
                  </span>
                  {nationalIdBack ? (
                    <div className="relative h-32 rounded-xl overflow-hidden border-2 border-emerald-500 bg-white">
                      <img
                        src={nationalIdBack}
                        alt="ID Back"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setNationalIdBack('')}
                        className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-bold"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <label className="h-32 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-500 flex flex-col items-center justify-center text-center cursor-pointer bg-white transition p-3">
                      <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="text-xs font-semibold text-slate-700">Upload ID Back</span>
                      <span className="text-[10px] text-slate-400">Clear readable photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleIdUpload(e, setNationalIdBack)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Driver's Licence (Mandatory for Motorbike/Car, Exempt for others) */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center text-[11px] font-black">
                    2
                  </span>
                  Driver's Licence
                </span>
                {isVehicle ? (
                  <span className="text-[10px] font-bold text-rose-700 uppercase bg-rose-100 px-2 py-0.5 rounded-md">
                    Mandatory for {transportMode}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-800 uppercase bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Exempted (No Vehicle)
                  </span>
                )}
              </div>

              {!isVehicle && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Exempted from Driver's Licence:</strong> Since you run errands by{' '}
                    <strong>{TRANSPORT_MODE_LABELS[transportMode].label}</strong>, a driver's licence is not required. You can proceed directly once your National ID is uploaded.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Licence Front */}
                <div>
                  <span className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Licence — Front Photo {isVehicle ? '*' : '(Optional)'}
                  </span>
                  {driverLicenceFront ? (
                    <div className="relative h-32 rounded-xl overflow-hidden border-2 border-emerald-500 bg-white">
                      <img
                        src={driverLicenceFront}
                        alt="Licence Front"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setDriverLicenceFront('')}
                        className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-bold"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <label className="h-32 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-500 flex flex-col items-center justify-center text-center cursor-pointer bg-white transition p-3">
                      <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="text-xs font-semibold text-slate-700">Licence Front</span>
                      <span className="text-[10px] text-slate-400">
                        {isVehicle ? 'Required for vehicles' : 'Optional upload'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleIdUpload(e, setDriverLicenceFront)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Licence Back */}
                <div>
                  <span className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Licence — Back Photo {isVehicle ? '*' : '(Optional)'}
                  </span>
                  {driverLicenceBack ? (
                    <div className="relative h-32 rounded-xl overflow-hidden border-2 border-emerald-500 bg-white">
                      <img
                        src={driverLicenceBack}
                        alt="Licence Back"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setDriverLicenceBack('')}
                        className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-bold"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <label className="h-32 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-500 flex flex-col items-center justify-center text-center cursor-pointer bg-white transition p-3">
                      <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="text-xs font-semibold text-slate-700">Licence Back</span>
                      <span className="text-[10px] text-slate-400">
                        {isVehicle ? 'Required for vehicles' : 'Optional upload'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleIdUpload(e, setDriverLicenceBack)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Area & Coverage */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Operating Town, City or Base Area *
              </label>
              <button
                type="button"
                onClick={() => setPickingLocation(true)}
                className="text-[11px] text-emerald-700 hover:underline font-semibold flex items-center gap-1"
              >
                <MapPin className="w-3 h-3" /> Pin on Map
              </button>
            </div>

            {/* Quick Town/City Chips & Dropdown covering all major Zim cities/towns */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={ZIM_MAJOR_CITIES.some((c) => c.name === areaName) ? areaName : areaName ? 'custom' : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'custom') {
                      setAreaName('');
                    } else if (val) {
                      const found = ZIM_MAJOR_CITIES.find((c) => c.name === val);
                      if (found) {
                        setAreaName(found.name);
                        setCentreCoords([found.lat, found.lng]);
                      }
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Choose a Zimbabwean City / Town --</option>
                  <optgroup label="Major Metropolitan Cities">
                    {ZIM_MAJOR_CITIES.filter((c) => c.isMajorCity).map((c) => (
                      <option key={c.id} value={c.name}>
                        📍 {c.name} ({c.province})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="All Towns & Regional Centers">
                    {ZIM_MAJOR_CITIES.filter((c) => !c.isMajorCity).map((c) => (
                      <option key={c.id} value={c.name}>
                        📍 {c.name} ({c.province})
                      </option>
                    ))}
                  </optgroup>
                  <option value="custom">✏️ Other (Custom Location / Neighborhood)...</option>
                </select>
              </div>

              {/* Popular quick chips */}
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200">
                {ZIM_MAJOR_CITIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setAreaName(c.name);
                      setCentreCoords([c.lat, c.lng]);
                    }}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition ${
                      areaName === c.name
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAreaName('')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition ${
                    !ZIM_MAJOR_CITIES.some((c) => c.name === areaName) && areaName !== ''
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  ✏️ Other (Custom)
                </button>
              </div>
            </div>

            <input
              type="text"
              required
              value={areaName}
              onChange={(e) => setAreaName(e.target.value)}
              placeholder="Type specific town, suburb, or custom location (e.g. Hwange Baobab, Norton Knowe, Victoria Falls Chinotimba)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
            />
            <span className="text-[11px] text-slate-400 block">
              All 28+ Zimbabwean cities, towns, or custom locations supported across all provinces.
            </span>

            <div>

              <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                <span>Coverage Radius:</span>
                <span className="font-bold text-emerald-700">{radiusKm} km</span>
              </div>
              <input
                type="range"
                min="1"
                max="25"
                step="0.5"
                value={radiusKm}
                onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
                className="w-full accent-emerald-600"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/25 transition cursor-pointer"
          >
            {isSubmitting ? 'Submitting KYC Documents...' : 'Submit Profile & KYC for Verification'}
          </button>
        </form>
      </div>

      {pickingLocation && (
        <LocationPickerModal
          isOpen={true}
          onClose={() => setPickingLocation(false)}
          title="Select Your Base Area"
          initialAddress={areaName}
          initialLat={centreCoords[0]}
          initialLng={centreCoords[1]}
          onSelect={(addr, lat, lng) => {
            setAreaName(addr);
            setCentreCoords([lat, lng]);
          }}
        />
      )}
    </div>
  );
};

