import { lazy } from 'react'

/**
 * Lab key (an entry's `lab` field) → component. Labs are grouped by topic and
 * each group is its own chunk, so opening BB84 does not download the boson
 * sampler.
 */
const from = (load, name) => lazy(() => load().then((m) => ({ default: m[name] })))

const qkd = () => import('./QkdLabs')
const crypto = () => import('./CryptoLabs')
const qec = () => import('./QecLabs')
const chars = () => import('./CharacterizationLabs')
const algA = () => import('./AlgorithmLabsA')
const algB = () => import('./AlgorithmLabsB')

export const LABS = {
  bb84: from(qkd, 'Bb84Lab'),
  e91: from(qkd, 'E91Lab'),
  b92: from(qkd, 'B92Lab'),
  'mdi-qkd': from(qkd, 'MdiLab'),
  'decoy-state': from(qkd, 'DecoyLab'),
  'tf-qkd': from(qkd, 'TfLab'),
  'cv-qkd': from(qkd, 'CvLab'),
  'secret-sharing': from(crypto, 'SecretSharingLab'),
  'coin-flipping': from(crypto, 'CoinFlipLab'),
  'wiesner-money': from(crypto, 'WiesnerLab'),
  'steane-code': from(qec, 'SteaneLab'),
  'surface-code': from(qec, 'SurfaceLab'),
  tomography: from(chars, 'TomographyLab'),
  'randomized-benchmarking': from(chars, 'RbLab'),
  'clock-sync': from(chars, 'ClockLab'),
  shor: from(algA, 'ShorLab'),
  'shor-dlog': from(algA, 'ShorDlogLab'),
  simon: from(algA, 'SimonLab'),
  hhl: from(algA, 'HhlLab'),
  'amplitude-amplification': from(algA, 'AmpAmpLab'),
  'quantum-counting': from(algA, 'CountingLab'),
  vqe: from(algB, 'VqeLab'),
  qaoa: from(algB, 'QaoaLab'),
  'quantum-walk': from(algB, 'WalkLab'),
  'element-distinctness': from(algB, 'DistinctnessLab'),
  'triangle-finding': from(algB, 'TriangleLab'),
  qsvm: from(algB, 'QsvmLab'),
  qpca: from(algB, 'QpcaLab'),
  'hamiltonian-simulation': from(algB, 'HamSimLab'),
  'boson-sampling': from(algB, 'BosonLab'),
}
