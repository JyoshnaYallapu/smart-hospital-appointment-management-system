from flask import Flask, render_template, request, redirect, session,flash
import sqlite3

app = Flask(__name__)
app.secret_key = "hospital123"


# ==========================
# DATABASE CREATION
# ==========================
def create_tables():
    conn = sqlite3.connect("hospital.db")
    cur = conn.cursor()

    # Doctors Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS doctors(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        specialization TEXT,
        email TEXT UNIQUE,
        password TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS patients(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        password TEXT
    )
    """)

    # Appointments Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS appointments(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        doctor_email TEXT,
        appointment_date TEXT,
        time_slot TEXT,
        symptoms TEXT,
        status TEXT DEFAULT 'Pending'
    )
    """)

    conn.commit()
    conn.close()


# ==========================
# INSERT DEFAULT DOCTORS
# ==========================
def insert_doctors():
    conn = sqlite3.connect("hospital.db")
    cur = conn.cursor()

    doctors = [
        ("Dr. Arjun Sharma", "Cardiology", "arjun@hospital.com", "123456"),
        ("Dr. Priya Mehta", "Pediatrics", "priya@hospital.com", "123456"),
        ("Dr. Rajesh Kumar", "Neurology", "rajesh@hospital.com", "123456"),
        ("Dr. Sunita Rao", "Orthopedics", "sunita@hospital.com", "123456"),
        ("Dr. Vikram Patel", "General Medicine", "vikram@hospital.com", "123456"),
        ("Dr. Ananya Singh", "Emergency Care", "ananya@hospital.com", "123456"),
        ("Dr. Mohan Das", "Cardiology", "mohan@hospital.com", "123456"),
        ("Dr. Kavitha Nair", "Neurology", "kavitha@hospital.com", "123456")
    ]

    for doctor in doctors:
        cur.execute("""
        INSERT OR IGNORE INTO doctors
        (name, specialization, email, password)
        VALUES (?, ?, ?, ?)
        """, doctor)

    conn.commit()
    conn.close()


# ==========================
# ROUTES
# ==========================

@app.route('/')
def login():
    return render_template('index.html')


@app.route('/home')
def home():
    if 'patient_email' not in session:
        return redirect('/patient-login')
    return render_template(
        'home.html',
        patient_name=session['patient_name']
    )


@app.route('/doctors')
def doctors():
    if 'patient_email' not in session:
        return redirect('/patient-login')
    return render_template(
        'doctors.html',
        patient_name=session['patient_name']
    )


@app.route('/doctor-dashboard')
def doctor_dashboard():

    if 'doctor_email' not in session:
        return redirect('/doctor-login')

    selected_date = request.args.get('selected_date')

    conn = sqlite3.connect("hospital.db")
    cur = conn.cursor()

    # Dashboard statistics
    cur.execute("""
    SELECT COUNT(*)
    FROM appointments
    WHERE doctor_email = ?
    AND status = 'Pending'
    """,
    (
        session['doctor_name'],
    ))

    pending = cur.fetchone()[0]

    cur.execute("""
    SELECT COUNT(*)
    FROM appointments
    WHERE doctor_email = ?
    AND status = 'Completed'
    """,
    (
        session['doctor_name'],
    ))

    completed = cur.fetchone()[0]

    total = pending + completed

    # Appointments table
    if selected_date:

        cur.execute("""
        SELECT *
        FROM appointments
        WHERE doctor_email = ?
        AND appointment_date = ?
        AND status = 'Pending'
        """,
        (
            session['doctor_name'],
            selected_date
        ))

    else:

        cur.execute("""
        SELECT *
        FROM appointments
        WHERE doctor_email = ?
        AND status = 'Pending'
        """,
        (
            session['doctor_name'],
        ))

    appointments = cur.fetchall()

    conn.close()

    return render_template(
        'doctor-dashboard.html',
        doctor_name=session['doctor_name'],
        appointments=appointments,
        total=total,
        pending=pending,
        completed=completed
    )


@app.route('/doctor-login', methods=['GET', 'POST'])
def doctor_login():

    if request.method == 'POST':

        email = request.form['email']
        password = request.form['password']

        conn = sqlite3.connect("hospital.db")
        cur = conn.cursor()

        cur.execute("""
            SELECT * FROM doctors
            WHERE email=? AND password=?
        """, (email, password))

        doctor = cur.fetchone()

        conn.close()

        if doctor:
            session['doctor_email'] = doctor[3]
            session['doctor_name'] = doctor[1]

            return redirect('/doctor-dashboard')
        else:
            return "Invalid Email or Password"

    return render_template('doctor-login.html')

@app.route('/book-appointment', methods=['POST'])
def book_appointment():

    patient_name = request.form['patientName']
    phone = request.form['phone']
    email = session['patient_email']
    doctor_name = request.form['doctorSelect']
    appointment_date = request.form['apptDate']
    time_slot = request.form['timeSlot']
    symptoms = request.form['symptoms']

    conn = sqlite3.connect("hospital.db")
    cur = conn.cursor()

    # Check if slot already booked
    cur.execute("""
        SELECT *
        FROM appointments
        WHERE doctor_email = ?
        AND appointment_date = ?
        AND time_slot = ?
    """,
    (
        doctor_name,
        appointment_date,
        time_slot
    ))

    existing = cur.fetchone()

    if existing:
        conn.close()
        return """
        <h2 style='color:red;text-align:center;margin-top:50px;'>
            This time slot is already booked.<br><br>
            Please choose another slot.
        </h2>
        <center>
            <a href='/appointments'>Go Back</a>
        </center>
        """

    # Insert appointment
    cur.execute("""
        INSERT INTO appointments
        (
            patient_name,
            phone,
            email,
            doctor_email,
            appointment_date,
            time_slot,
            symptoms
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """,
    (
        patient_name,
        phone,
        email,
        doctor_name,
        appointment_date,
        time_slot,
        symptoms
    ))

    conn.commit()
    conn.close()
    flash("Appointment Booked Successfully!")

    return redirect('/appointments')

@app.route('/appointments')
def appointments():

    if 'patient_email' not in session:
        return redirect('/patient-login')

    conn = sqlite3.connect("hospital.db")
    cur = conn.cursor()

    cur.execute("""
    SELECT *
    FROM appointments
    WHERE email = ?
    """,
    (
        session['patient_email'],
    ))

    appointments = cur.fetchall()

    conn.close()

    return render_template(
        'appointments.html',
        appointments=appointments
    )

@app.route('/complete-appointment/<int:appointment_id>')
def complete_appointment(appointment_id):

    conn = sqlite3.connect("hospital.db")
    cur = conn.cursor()

    cur.execute("""
    UPDATE appointments
    SET status='Completed'
    WHERE id=?
    """, (appointment_id,))

    conn.commit()
    conn.close()

    return redirect('/doctor-dashboard')

@app.route('/appointment-history')
def appointment_history():

    conn = sqlite3.connect("hospital.db")
    cur = conn.cursor()

    cur.execute("""
    SELECT *
    FROM appointments
    WHERE status='Completed'
    AND doctor_email=?
    ORDER BY id DESC
    """,(session['doctor_name'],))

    appointments = cur.fetchall()

    conn.close()

    return render_template(
        'appointment-history.html',
        appointments=appointments
    )

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/')

@app.route('/patient-register')
def patient_register():
    return render_template('patient-register.html')

@app.route('/register-patient', methods=['POST'])
def register_patient():

    name = request.form['name']
    email = request.form['email']
    password = request.form['password']

    conn = sqlite3.connect("hospital.db")
    cur = conn.cursor()

    cur.execute("""
    INSERT INTO patients(name,email,password)
    VALUES(?,?,?)
    """,(name,email,password))

    conn.commit()
    conn.close()

    return redirect('/patient-login')

@app.route('/patient-login')
def patient_login():
    return render_template('patient-login.html')

@app.route('/login-patient', methods=['POST'])
def login_patient():

    email = request.form['email']
    password = request.form['password']

    conn = sqlite3.connect("hospital.db")
    cur = conn.cursor()

    cur.execute("""
    SELECT *
    FROM patients
    WHERE email=? AND password=?
    """,(email,password))

    patient = cur.fetchone()

    conn.close()

    if patient:

        session['patient_email'] = patient[2]
        session['patient_name'] = patient[1]

        return redirect('/home')

    return "Invalid Login"

@app.route('/patient-logout')
def patient_logout():

    session.pop('patient_email', None)
    session.pop('patient_name', None)

    return redirect('/')

@app.route('/delete-appointment/<int:id>')
def delete_appointment(id):

    conn = sqlite3.connect("hospital.db")
    cur = conn.cursor()

    cur.execute("""
    DELETE FROM appointments
    WHERE id = ?
    AND email = ?
    """, (id, session['patient_email']))

    conn.commit()
    conn.close()

    return redirect('/appointments')

# ==========================
# MAIN
# ==========================
if __name__ == '__main__':
    create_tables()
    insert_doctors()
    app.run(debug=True)