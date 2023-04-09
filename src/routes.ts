import dayjs from './lib/dayjs'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from "./lib/prisma"

export async function appRoutes(app: FastifyInstance) {

  app.post('/habits', async (request) => {
    const createHabitBody = z.object({
      title: z.string(),
      weekDays: z.array(
        z.number().min(0).max(6)
      )
    })

    const { title, weekDays } = createHabitBody.parse(request.body)

    const today = dayjs.utc().toDate()

    await prisma.habit.create({
      data: {
        title,
        created_at: today,
        weekDays: {
          create: weekDays.map(weekDay => {
            return {
              week_day: weekDay
            }
          })
        }
      }
    })

  })

  app.get('/day', async (request) => {
    const getDayParams = z.object({
      date: z.coerce.date()
    })

    const { date } = getDayParams.parse(request.query)

    const initialDate = dayjs(date)

    const endDate = initialDate.add(1, 'day').toDate()

    const weekDay = initialDate.get('day')

    const possibleHabits = await prisma.habit.findMany({
      where: {
        created_at: {
          lt: endDate,
        },
        weekDays: {
          some: {
            week_day: weekDay
          }
        }
      }
    })

    const day = await prisma.day.findUnique({
      where: {
        date: initialDate.toDate()
      },
      include: {
        dayHabits: true
      }
    })

    const completedHabits = day?.dayHabits.map(dayHabit => {
      return dayHabit.habit_id
    }) ?? []

    return {
      possibleHabits,
      completedHabits
    }
  })

  app.patch('/habits/:id/date/:date/toggle', async (request) => {
    const toggleHabitParams = z.object({
      id: z.string().uuid(),
      date: z.coerce.date()
    })

    const { id, date } = toggleHabitParams.parse(request.params)

    let day = await prisma.day.findUnique({
      where: {
        date: date
      }
    })

    if (!day) {
      day = await prisma.day.create({
        data: {
          date: date
        }
      })
    }

    const dayHabit = await prisma.dayHabit.findUnique({
      where: {
        day_id_habit_id: {
          day_id: day.id,
          habit_id: id
        }
      }
    })

    if (dayHabit) {
      await prisma.dayHabit.delete({
        where: {
          id: dayHabit.id
        }
      })
    } else {
      await prisma.dayHabit.create({
        data: {
          day_id: day.id,
          habit_id: id
        }
      })
    }

  })

  app.get('/summary', async () => {
    const summary = await prisma.$queryRaw`
      SELECT 
        D.id,
        D.date,
        (
          SELECT 
            cast(count(*) as float) 
          FROM day_habits DH
          WHERE DH.day_id = D.id
        ) as completed,
        (
          SELECT
            cast(count(*) as float) 
          FROM habit_week_days HWD
          JOIN habits H
            ON H.id = HWD.habit_id
          WHERE 
            -- HWD.week_day = cast(strftime('%w', D.date / 1000.0, 'unixepoch') as int)
            HWD.week_day = (to_char(D.date, 'D')::int - 1)
            -- AND H.created_at <= (D.date + interval '10 day')
            AND H.created_at <= D.date
        ) as amount
      FROM days D
    `

    return summary
  })

  app.get('/cycle', async() => {
    // pega todos os hábitos válidos, e calcula a quantidade de checks consecutivos
    const habits = await prisma.habit.findMany({
      orderBy:{
        created_at: 'desc'
      },
      include:{
        weekDays: {
          select: {
            week_day: true
          }
        },
        dayHabits: {
          select: {
            day: {
              select: {
                date: true
              }
            }
          }
        }
      }
    })

    const consecutiveHabits = habits.map(habit => {

      let dayIterator = dayjs()

      const weekdayList = habit['weekDays'].map(weekDay => weekDay.week_day)

      // console.log(weekdayList)

      const dayCheckedList = habit['dayHabits'].map(dayHabit => dayHabit?.day.date).map(date => dayjs(date))

      // console.log(dayCheckedList)
    
      let countConsecutiveDays = 0

      // percorre o array de trás pra frente até o primeiro dia do hábito
      while (dayIterator.isAfter(habit.created_at)) {
        // console.log(dayIterator)

        // se esse dia da semana não for requisito, vai pro próximo
        if (weekdayList.includes(dayIterator.day())) {
          
          // checa se o dia foi marcado como hábito concluído
          const isDayChecked = dayCheckedList.some(dayChecked => {
            return dayChecked.isSame(dayIterator, 'day')
          })

          // console.log(isDayChecked)

          if (isDayChecked) {
            countConsecutiveDays += 1
          } else {
            break
          }
        }

        dayIterator = dayIterator.subtract(1, 'day')
      }

      return {
        id: habit.id,
        title: habit.title,
        count_consecutive: countConsecutiveDays

      }
    })

    return consecutiveHabits
  })
}
