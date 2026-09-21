/* ==========================================================================
   E-Waste Tracker — configuration
   Change CONTRACT_ADDRESS here if you redeploy the contract. Nothing else
   in the project needs to be edited.
   ========================================================================== */
window.EW_CONFIG = {
  CONTRACT_ADDRESS: "0x477B589E3bE87aCf76B34308E641Cc3C2D402ff6",

  CHAIN_ID: 11155111,
  CHAIN_HEX: "0xaa36a7",
  CHAIN_NAME: "Sepolia",
  EXPLORER: "https://sepolia.etherscan.io",

  // Public read-only RPC: lets anyone look up a device without a wallet.
  RPC_URL: "https://ethereum-sepolia-rpc.publicnode.com",

  // Same order as the Status enum in EWasteTracking.sol
  STATUS_LABELS: [
    "Registered",
    "QR generated",
    "Sold with consumer",
    "Collected",
    "Processing",
    "Recycled / disposed",
    "Closed"
  ],

  // Human-readable ABI (ethers v6). Equivalent to the compiled JSON ABI;
  // Solidity enums are encoded as uint8.
  ABI: [
    // Errors
    "error AccessControlBadConfirmation()",
    "error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)",
    "error ReentrancyGuardReentrantCall()",

    // Events
    "event DeviceRegistered(uint256 indexed deviceId, address indexed manufacturer, string deviceType, string serialNumber)",
    "event OwnershipTransferAccepted(uint256 indexed deviceId, address indexed from, address indexed to, uint256 timestamp)",
    "event OwnershipTransferInitiated(uint256 indexed deviceId, address indexed from, address indexed to)",
    "event QRCodeGenerated(uint256 indexed deviceId, string qrCodeHash)",
    "event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole)",
    "event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)",
    "event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)",
    "event StatusUpdated(uint256 indexed deviceId, uint8 newStatus, address indexed updatedBy, uint256 timestamp, string ipfsDocHash)",

    // Role constants
    "function COLLECTOR_ROLE() view returns (bytes32)",
    "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
    "function MANUFACTURER_ROLE() view returns (bytes32)",
    "function RECYCLER_ROLE() view returns (bytes32)",
    "function REGULATOR_ROLE() view returns (bytes32)",

    // Writes
    "function registerDevice(string deviceType, string manufacturerName, uint256 dateOfManufacture, string serialNumber) returns (uint256)",
    "function generateQRCode(uint256 deviceId, string qrCodeHash)",
    "function updateStatus(uint256 deviceId, uint8 newStatus, string ipfsDocHash)",
    "function initiateOwnershipTransfer(uint256 deviceId, address newOwner)",
    "function acceptOwnershipTransfer(uint256 deviceId)",
    "function grantRole(bytes32 role, address account)",
    "function revokeRole(bytes32 role, address account)",
    "function renounceRole(bytes32 role, address callerConfirmation)",

    // Reads
    "function deviceCounter() view returns (uint256)",
    "function devices(uint256) view returns (uint256 id, string deviceType, string manufacturerName, uint256 dateOfManufacture, string serialNumber, address manufacturer, address currentOwner, uint8 status, string qrCodeHash, bool exists)",
    "function devicesByType(string) view returns (uint256)",
    "function getDashboardStats() view returns (uint256 registered, uint256 collected, uint256 recycled, uint256 disposed)",
    "function getDeviceById(uint256 deviceId) view returns (tuple(uint256 id, string deviceType, string manufacturerName, uint256 dateOfManufacture, string serialNumber, address manufacturer, address currentOwner, uint8 status, string qrCodeHash, bool exists))",
    "function getDeviceByQR(string qrCodeHash) view returns (tuple(uint256 id, string deviceType, string manufacturerName, uint256 dateOfManufacture, string serialNumber, address manufacturer, address currentOwner, uint8 status, string qrCodeHash, bool exists))",
    "function getDeviceCountByType(string deviceType) view returns (uint256)",
    "function getDeviceHistory(uint256 deviceId) view returns (tuple(uint8 status, address updatedBy, uint256 timestamp, string ipfsDocHash)[])",
    "function getOwnershipHistory(uint256 deviceId) view returns (tuple(address from, address to, uint256 timestamp)[])",
    "function getRecyclerActivity(address recycler) view returns (uint256)",
    "function getRoleAdmin(bytes32 role) view returns (bytes32)",
    "function getUserRoles(address account) view returns (bool isAdmin, bool isManufacturer, bool isCollector, bool isRecycler, bool isRegulator)",
    "function hasRole(bytes32 role, address account) view returns (bool)",
    "function qrCodeUsed(string) view returns (bool)",
    "function qrToDeviceId(string) view returns (uint256)",
    "function recyclerActivity(address) view returns (uint256)",
    "function supportsInterface(bytes4 interfaceId) view returns (bool)",
    "function totalCollected() view returns (uint256)",
    "function totalDisposed() view returns (uint256)",
    "function totalRecycled() view returns (uint256)",
    "function totalRegisteredDevices() view returns (uint256)",
    "function transferRequests(uint256) view returns (address from, address to, bool pending)"
  ]
};
