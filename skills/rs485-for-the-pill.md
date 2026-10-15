# Skill: RS485 Communication for "The Pill" (5-Terminal Add-on)

## **Description**
This skill provides the technical framework for configuring **The Pill** to communicate via **RS485** using the **5-Terminal Add-on**. It specifically maps the transition from standard UART to a Half-Duplex RS485 interface, utilizing **IO3** for direction control.

---

## **Technical Wiring & Signal Mapping**
In RS485 mode, the terminal functions shift from independent Transmit/Receive lines to a differential pair system with active flow control.

| 5-Terminal Add-on Pin | RS485 Function | 3rd Party Device Pin | Direction | Description |
| :--- | :--- | :--- | :---: | :--- |
| **GND** | **GND** | GND | <---> | Common ground reference for signal stability. |
| **IO1 (TX)** | **Data B / (-)** | B / D- | <---> | Inverting differential signal line. |
| **IO2 (RX)** | **Data A / (+)** | A / D+ | <---> | Non-inverting differential signal line. |
| **IO3** | **RI / DO** | DE / RE | <---- | **Direction Control:** High = Transmit / Low = Receive. |
| **5V** | **VCC** | 5V | ----> | Power supply for the 3rd party transceiver. |



---

## **Implementation Requirements**

### **1. Physical Layer (Hardware)**
* **Differential Pair:** IO1 and IO2 form the balanced line. Ensure these wires are twisted together if the cable run is long to minimize electromagnetic interference (EMI).
* **Flow Control:** Connect **IO3** to the **Data Enable (DE)** and **Receiver Enable (RE)** pins of your RS485 transceiver.

### **2. Software Logic (Half-Duplex)**
Since RS485 is half-duplex, you cannot "talk" and "listen" at the same time. The firmware must manage the state of **IO3**:
* **Transmit Mode:** Set `IO3` to **HIGH** immediately before sending the data packet.
* **Receive Mode:** Set `IO3` to **LOW** immediately after the final byte has been physically shifted out of the UART buffer.

### **3. Termination & Bias**
* **120Ω Resistor:** If the bus is longer than 10 meters, place a 120Ω resistor across IO1 and IO2 at the physical end of the bus to prevent signal reflections.
* **Common Ground:** Always connect the GND pin to prevent common-mode voltage spikes from damaging the hardware.

---

## **Quick Integration Guide**
> **AI Instruction:** "To enable RS485 on The Pill, wire the A/B lines to IO2 and IO1. Use **IO3** as your toggle: Pull it **HIGH** to 'Talk' and **LOW** to 'Listen'. If you experience data corruption over long distances, ensure you have a common ground and a 120Ω termination resistor."